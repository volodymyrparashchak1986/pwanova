"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { z } from "zod"
import { authed, fail } from "./common"
import { analyzeUrl } from "@/lib/analyzer"
import { runAppChecks } from "@/lib/checks"
import { createAdminClient } from "@/lib/supabase/admin"
import { cleanHttpUrl, cleanText } from "@/lib/security/sanitize"
import { rateLimit } from "@/lib/security/rate-limit"
import { verifyOwnership, type ClaimMethod } from "@/lib/verification"
import { BUILD_TOOLS, CATEGORIES, HOSTS, LAUNCH_SOURCES, PARTNER_COOKIE } from "@/lib/constants"
import { domainOf, parsePublicUrl, slugify, UrlError } from "@/lib/url"
import type { ActionResult } from "@/lib/types"

const submitSchema = z.object({
  url: z.string().min(3).max(2048),
  name: z.string().min(1, "App name is required").max(80),
  tagline: z.string().min(3, "Add a short tagline").max(120),
  description: z.string().max(4000).optional(),
  category: z.enum(CATEGORIES.map((c) => c.slug) as [string, ...string[]]),
  buildTool: z.enum(BUILD_TOOLS.map((c) => c.slug) as [string, ...string[]]),
  hostingProvider: z.enum(HOSTS.map((c) => c.slug) as [string, ...string[]]),
  launchSource: z.enum(LAUNCH_SOURCES).optional(),
  launchUrl: z.string().max(500).optional(),
  iconUrl: z.string().max(500).optional(),
  screenshots: z.array(z.string().max(500)).max(8).optional(),
})
export type SubmitInput = z.infer<typeof submitSchema>

/** Create a listing. Ownership starts as `claim_pending`; PWANova Verified requires verification. */
export async function submitApp(input: SubmitInput): Promise<ActionResult<{ slug: string }> & { existingSlug?: string }> {
  const parsed = submitSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0].message)
  const ctx = await authed("submit", { max: 5, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const v = parsed.data

  let url: URL
  try { url = parsePublicUrl(v.url) } catch (e) { return fail(e instanceof UrlError ? e.message : "Invalid URL.") }
  const domain = domainOf(url)

  const { data: dupe } = await ctx.sb.from("apps").select("slug").eq("domain", domain).maybeSingle()
  if (dupe) return { ok: false, error: "This app is already listed. You can claim it instead.", existingSlug: dupe.slug }

  // Never trust client-side analysis for trust signals: re-run on the server.
  const analysis = await analyzeUrl(url.href)

  let slug = slugify(v.name)
  const { data: taken } = await ctx.sb.from("apps").select("slug").like("slug", `${slug}%`)
  if (taken?.some((t) => t.slug === slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`

  const requireApproval = process.env.SUBMIT_REQUIRES_APPROVAL === "true"
  const { data: app, error } = await ctx.sb.from("apps").insert({
    developer_id: ctx.user.id, name: cleanText(v.name, 80), slug, tagline: cleanText(v.tagline, 120),
    description: cleanText(v.description, 4000), url: url.href, domain,
    icon_url: cleanHttpUrl(v.iconUrl) ?? analysis.iconUrl, category: v.category,
    build_tool: v.buildTool, hosting_provider: v.hostingProvider === "other" ? analysis.host : v.hostingProvider,
    status: requireApproval ? "pending" : "published",
  }).select("id, slug").single()
  if (error || !app) return fail(error?.message.includes("Rate limit") ? "You've submitted too many apps today." : "Could not create the listing.")

  // claim token so the developer can verify right away
  await ctx.sb.from("app_claims").insert({ app_id: app.id, user_id: ctx.user.id })

  const shots = (v.screenshots?.length ? v.screenshots : analysis.screenshots).map((s) => cleanHttpUrl(s)).filter((s): s is string => Boolean(s))
  if (shots.length) await ctx.sb.from("app_screenshots").insert(shots.map((image_url, i) => ({ app_id: app.id, image_url, sort_order: i })))

  const launch = v.launchSource ?? "Direct"
  const partnerRef = (await cookies()).get(PARTNER_COOKIE)?.value
  const admin = createAdminClient()
  let partnerId: string | null = null
  if (admin) {
    const { data: partner } = await admin.from("partners").select("id").or(`name.ilike.${launch.replace(/[^a-zA-Z ]/g, "")},slug.eq.${(partnerRef ?? "-").replace(/[^a-z0-9_-]/g, "")},referral_code.eq.${(partnerRef ?? "-").replace(/[^a-z0-9_-]/g, "")}`).limit(1).maybeSingle()
    partnerId = partner?.id ?? null
  }
  const launchPartnerMatch = admin && partnerId && (await admin.from("partners").select("name").eq("id", partnerId).maybeSingle()).data?.name.toLowerCase() === launch.toLowerCase()
  await (admin ?? ctx.sb).from("app_sources").insert({
    app_id: app.id, partner_id: launchPartnerMatch ? partnerId : null, source_name: launch,
    source_url: cleanHttpUrl(v.launchUrl), source_type: "launched_on",
  })
  if (admin && partnerId && !launchPartnerMatch) {
    // arrived via a partner link but launched elsewhere: keep launch source, record discovery attribution
    await admin.from("app_sources").insert({ app_id: app.id, partner_id: partnerId, source_name: "Partner referral", source_type: "discovered_via" })
  }
  if (partnerId) await ctx.sb.from("partner_referrals").insert({ partner_id: partnerId, developer_id: ctx.user.id, app_id: app.id })

  await runAppChecks(app.id) // no-op without a service role key
  revalidatePath("/dashboard")
  revalidatePath("/explore")
  return { ok: true, data: { slug: app.slug } }
}

/** Begin (or resume) an ownership claim for a listed app. */
export async function startClaim(appId: string): Promise<ActionResult> {
  const ctx = await authed("claim", { max: 10, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const { data: app } = await ctx.sb.from("apps").select("id, slug, ownership_status").eq("id", appId).maybeSingle()
  if (!app) return fail("App not found.")
  if (app.ownership_status === "verified_owner") return fail("This app already has a verified owner.")
  const { error } = await ctx.sb.from("app_claims").upsert({ app_id: appId, user_id: ctx.user.id }, { onConflict: "app_id,user_id", ignoreDuplicates: true })
  if (error) return fail("Could not start the claim.")
  const admin = createAdminClient()
  if (admin && app.ownership_status === "unclaimed") await admin.from("apps").update({ ownership_status: "claim_pending" }).eq("id", appId)
  revalidatePath(`/apps/${app.slug}`)
  return { ok: true }
}

const methodSchema = z.enum(["meta_tag", "well_known", "dns_txt"])

/** Checks the claim token on the live site. Only a server-side success can grant ownership (service role). */
export async function verifyClaim(appId: string, method: ClaimMethod): Promise<ActionResult<{ verified: boolean }>> {
  if (!methodSchema.safeParse(method).success) return fail("Unknown method.")
  const ctx = await authed("verify-claim", { max: 12, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const admin = createAdminClient()
  if (!admin) return fail("Ownership verification needs SUPABASE_SERVICE_ROLE_KEY on the server.")

  const [{ data: claim }, { data: app }] = await Promise.all([
    ctx.sb.from("app_claims").select("id, token").eq("app_id", appId).eq("user_id", ctx.user.id).maybeSingle(),
    admin.from("apps").select("id, slug, url, domain").eq("id", appId).maybeSingle(),
  ])
  if (!claim || !app) return fail("Start a claim first.")

  const result = await verifyOwnership(app.url, app.domain, claim.token, method)
  if (!result.ok) {
    await admin.from("app_claims").update({ last_error: result.error, status: "pending" }).eq("id", claim.id)
    return fail(result.error ?? "Verification failed.")
  }
  const now = new Date().toISOString()
  await admin.from("app_claims").update({ status: "verified", method, verified_at: now, last_error: null }).eq("id", claim.id)
  await admin.from("app_claims").update({ status: "expired" }).eq("app_id", appId).neq("id", claim.id)
  await admin.from("apps").update({ developer_id: ctx.user.id, ownership_status: "verified_owner" }).eq("id", appId)
  const checks = await runAppChecks(appId)
  revalidatePath(`/apps/${app.slug}`)
  revalidatePath("/dashboard")
  return { ok: true, data: { verified: Boolean(checks.verified) }, message: "Ownership verified." }
}

/** Owner-triggered quality re-check. */
export async function recheckApp(appId: string): Promise<ActionResult> {
  const ctx = await authed("recheck", { max: 6, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const { data: app } = await ctx.sb.from("apps").select("id, slug, developer_id").eq("id", appId).maybeSingle()
  if (!app || app.developer_id !== ctx.user.id) return fail("You can only re-check your own apps.")
  const r = await runAppChecks(appId)
  if (!r.ok) return fail(r.error ?? "Check failed.")
  revalidatePath(`/apps/${app.slug}`)
  return { ok: true, message: "Checks updated." }
}

const profileSchema = z.object({
  displayName: z.string().min(1).max(80),
  bio: z.string().max(500).optional(),
  website: z.string().max(300).optional(),
})
export async function updateProfile(input: z.infer<typeof profileSchema>): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) return fail("Check your profile fields.")
  const ctx = await authed("profile", { max: 20, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const { error } = await ctx.sb.from("profiles").update({
    display_name: cleanText(parsed.data.displayName, 80), bio: cleanText(parsed.data.bio, 500) || null, website: cleanHttpUrl(parsed.data.website, 300),
  }).eq("id", ctx.user.id)
  if (error) return fail("Could not save your profile.")
  revalidatePath("/profile")
  return { ok: true, message: "Profile saved." }
}

// re-exported helper so the ship form can call analysis without a fetch round trip
export async function analyzeApp(url: string) {
  const ctx = await authed("analyze", { max: 20, windowSeconds: 3600 })
  if (!ctx.ok) return { ok: false as const, error: ctx.error }
  try {
    parsePublicUrl(url)
  } catch (e) {
    return { ok: false as const, error: e instanceof UrlError ? e.message : "Invalid URL." }
  }
  if (!(await rateLimit(`analyze-ip:${ctx.user.id}`, 40, 86400))) return { ok: false as const, error: "Daily analysis limit reached." }
  const a = await analyzeUrl(url)
  return { ok: true as const, analysis: a }
}
