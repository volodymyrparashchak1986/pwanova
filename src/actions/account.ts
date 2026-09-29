"use server"

import { z } from "zod"
import { authed, fail } from "./common"
import { msg } from "./messages"
import { cookies } from "next/headers"
import { isLocale, LOCALE_COOKIE, LOCALES } from "@/i18n/config"
import { isSupabaseConfigured } from "@/lib/env"
import { recordEvent } from "@/lib/events"
import { revalidateLocalized } from "@/lib/revalidate"
import { clientIp, rateLimit } from "@/lib/security/rate-limit"
import { cleanHttpUrl, cleanText } from "@/lib/security/sanitize"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { comparisonKey, comparisonSlugs, MAX_COMPARE } from "@/lib/v2/compare"
import type { ActionResult } from "@/lib/types"

const uuid = z.string().uuid()

// ------------------------------------------------------------------ newsletter
const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  locale: z.enum(LOCALES),
  source: z.string().max(40).regex(/^[a-z0-9_-]+$/),
  consent: z.literal(true),
  consentText: z.string().min(10).max(600),
})

/**
 * Stores the address together with the exact wording the person agreed to. There is no public insert
 * policy on the table: the write goes through the service role after validation and a rate limit.
 * The answer is the same whether or not the address was already subscribed.
 */
export async function subscribeNewsletter(input: { email: string; locale: string; source: string; consent: boolean; consentText: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = newsletterSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: await msg(parsed.error.issues[0]?.path[0] === "consent" ? "consent" : "email") }
  if (!isSupabaseConfigured) return { ok: false, error: await msg("needsDatabase") }
  if (!(await rateLimit(`newsletter:${await clientIp()}`, 5, 3600))) return { ok: false, error: await msg("tooFast") }
  const admin = createAdminClient()
  if (!admin) return { ok: false, error: await msg("needsDatabase") }
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  const v = parsed.data
  const { data: existing } = await admin.from("newsletter_subscriptions").select("id, unsubscribed_at").eq("email", v.email).maybeSingle()
  if (existing && !existing.unsubscribed_at) return { ok: true }
  const row = { email: v.email, locale: v.locale, consent_source: v.source, consent_text: cleanText(v.consentText, 600), consent_at: new Date().toISOString(), user_id: user?.id ?? null, unsubscribed_at: null }
  const { error } = existing
    ? await admin.from("newsletter_subscriptions").update(row).eq("id", existing.id)
    : await admin.from("newsletter_subscriptions").insert(row)
  if (error) { console.error("subscribeNewsletter", error.message); return { ok: false, error: await msg("failed") } }
  return { ok: true }
}

// ------------------------------------------------------------------ follows
export async function toggleFollow(appId: string): Promise<ActionResult<{ following: boolean }>> {
  if (!uuid.safeParse(appId).success) return fail(await msg("invalid"))
  const ctx = await authed("follow", { max: 120, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const { data: existing } = await ctx.sb.from("follows").select("app_id").eq("app_id", appId).eq("user_id", ctx.user.id).maybeSingle()
  const { error } = existing
    ? await ctx.sb.from("follows").delete().eq("app_id", appId).eq("user_id", ctx.user.id)
    : await ctx.sb.from("follows").insert({ app_id: appId, user_id: ctx.user.id })
  if (error) return fail(await msg("failed"))
  if (!existing) await recordEvent({ appId, type: "follow", userId: ctx.user.id })
  revalidateLocalized("/saved")
  return { ok: true, data: { following: !existing } }
}

export async function toggleCategoryFollow(categoryId: string): Promise<ActionResult<{ following: boolean }>> {
  if (!uuid.safeParse(categoryId).success) return fail(await msg("invalid"))
  const ctx = await authed("follow-category", { max: 60, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const { data: existing } = await ctx.sb.from("category_follows").select("category_id").eq("category_id", categoryId).eq("user_id", ctx.user.id).maybeSingle()
  const { error } = existing
    ? await ctx.sb.from("category_follows").delete().eq("category_id", categoryId).eq("user_id", ctx.user.id)
    : await ctx.sb.from("category_follows").insert({ category_id: categoryId, user_id: ctx.user.id })
  if (error) return fail(await msg("failed"))
  return { ok: true, data: { following: !existing } }
}

// ------------------------------------------------------------------ notifications
export async function markNotificationsRead(ids?: string[]): Promise<ActionResult> {
  const parsed = z.array(uuid).max(200).optional().safeParse(ids)
  if (!parsed.success) return fail(await msg("invalid"))
  const ctx = await authed("notifications", { max: 120, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  let q = ctx.sb.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", ctx.user.id).is("read_at", null)
  if (parsed.data?.length) q = q.in("id", parsed.data)
  const { error } = await q
  if (error) return fail(await msg("failed"))
  revalidateLocalized("/notifications")
  return { ok: true }
}

// ------------------------------------------------------------------ comparisons
/** Saves a comparison to the account. The apps are resolved on the server; the key is always canonical. */
export async function saveComparison(slugs: string[], title?: string): Promise<ActionResult<{ key: string }>> {
  const clean = comparisonSlugs(z.array(z.string().max(80)).max(MAX_COMPARE * 2).catch([]).parse(slugs))
  if (clean.length < 2) return fail(await msg("compareMin"))
  const ctx = await authed("comparison", { max: 30, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const { data: apps } = await ctx.sb.from("apps").select("id, slug").in("slug", clean).eq("status", "published")
  const found = clean.map((s) => apps?.find((a) => a.slug === s)).filter((a): a is { id: string; slug: string } => Boolean(a))
  if (found.length < 2) return fail(await msg("compareMin"))
  const key = comparisonKey(found.map((a) => a.slug))
  const { data: existing } = await ctx.sb.from("comparisons").select("id").eq("user_id", ctx.user.id).eq("slug_key", key).maybeSingle()
  if (existing) return { ok: true, data: { key } }
  const { data: row, error } = await ctx.sb.from("comparisons").insert({ user_id: ctx.user.id, slug_key: key, title: cleanText(title, 120) || null }).select("id").single()
  if (error || !row) return fail(await msg("failed"))
  const { error: itemsError } = await ctx.sb.from("comparison_apps").insert(found.map((a, i) => ({ comparison_id: row.id, app_id: a.id, position: i + 1 })))
  if (itemsError) {
    await ctx.sb.from("comparisons").delete().eq("id", row.id)
    return fail(await msg("failed"))
  }
  revalidateLocalized("/saved")
  return { ok: true, data: { key } }
}

export async function deleteComparison(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return fail(await msg("invalid"))
  const ctx = await authed("comparison-delete", { max: 60, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const { error } = await ctx.sb.from("comparisons").delete().eq("id", id).eq("user_id", ctx.user.id)
  if (error) return fail(await msg("failed"))
  revalidateLocalized("/saved")
  return { ok: true }
}

// ------------------------------------------------------------------ profile
const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  bio: z.string().max(500).optional(),
  website: z.string().max(300).optional(),
  locale: z.string().optional(),
})

export async function saveProfile(input: z.infer<typeof profileSchema>): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) return fail(await msg("invalid"))
  const ctx = await authed("profile", { max: 20, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const v = parsed.data
  const { error } = await ctx.sb.from("profiles").update({
    display_name: cleanText(v.displayName, 80), bio: cleanText(v.bio, 500) || null, website: cleanHttpUrl(v.website, 300),
    locale: isLocale(v.locale) ? v.locale : null,
  }).eq("id", ctx.user.id)
  if (error) return fail(await msg("failed"))
  if (isLocale(v.locale)) (await cookies()).set(LOCALE_COOKIE, v.locale, { maxAge: 60 * 60 * 24 * 365, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" })
  revalidateLocalized("/profile")
  return { ok: true, message: await msg("saved") }
}
