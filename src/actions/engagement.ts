"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { appMeta, authed, fail } from "./common"
import { cleanText } from "@/lib/security/sanitize"
import { recordEvent } from "@/lib/events"
import { REPORT_REASONS } from "@/lib/constants"
import type { ActionResult } from "@/lib/types"

const ratingSchema = z.number().int().min(1, "Choose 1 to 5 stars").max(5, "Choose 1 to 5 stars")

/** One rating per user per app (unique app_id + user_id). Calling again changes it. */
export async function rateApp(appId: string, rating: number): Promise<ActionResult> {
  const parsed = ratingSchema.safeParse(rating)
  if (!parsed.success) return fail(parsed.error.issues[0].message)
  const ctx = await authed("rating", { max: 40, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const app = await appMeta(ctx.sb, appId)
  if (!app) return fail("App not found.")
  if (app.developer_id === ctx.user.id) return fail("You can't rate your own app.")

  const { error } = await ctx.sb.from("ratings").upsert({ app_id: appId, user_id: ctx.user.id, rating }, { onConflict: "app_id,user_id" })
  if (error) return fail("Could not save your rating.")
  await recordEvent({ appId, type: "rating", userId: ctx.user.id, metadata: { rating } })
  revalidatePath(`/apps/${app.slug}`)
  return { ok: true, message: "Thanks for rating!" }
}

const reviewSchema = z.object({
  rating: ratingSchema,
  title: z.string().max(100).optional(),
  body: z.string().min(10, "Write at least 10 characters.").max(3000),
})

export async function saveReview(appId: string, input: { rating: number; title?: string; body: string }): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0].message)
  const ctx = await authed("review", { max: 15, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const app = await appMeta(ctx.sb, appId)
  if (!app) return fail("App not found.")
  if (app.developer_id === ctx.user.id) return fail("You can't review your own app.")

  const { data: existing } = await ctx.sb.from("reviews").select("id").eq("app_id", appId).eq("user_id", ctx.user.id).maybeSingle()
  const row = { app_id: appId, user_id: ctx.user.id, rating: parsed.data.rating, title: cleanText(parsed.data.title, 100) || null, body: cleanText(parsed.data.body, 3000) }
  const { error } = existing
    ? await ctx.sb.from("reviews").update({ rating: row.rating, title: row.title, body: row.body }).eq("id", existing.id)
    : await ctx.sb.from("reviews").insert(row)
  if (error) return fail(error.message.includes("Rate limit") ? "Too many reviews. Try again later." : "Could not save your review.")
  if (!existing) await recordEvent({ appId, type: "review", userId: ctx.user.id })
  revalidatePath(`/apps/${app.slug}`)
  return { ok: true, message: existing ? "Review updated." : "Review posted." }
}

export async function deleteReview(appId: string): Promise<ActionResult> {
  const ctx = await authed("review-delete", { max: 30, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const app = await appMeta(ctx.sb, appId)
  const { error } = await ctx.sb.from("reviews").delete().eq("app_id", appId).eq("user_id", ctx.user.id)
  if (error) return fail("Could not delete your review.")
  if (app) revalidatePath(`/apps/${app.slug}`)
  return { ok: true, message: "Review text deleted. Your rating is unchanged." }
}

export async function toggleHelpful(reviewId: string, slug: string): Promise<ActionResult<{ helpful: boolean }>> {
  const ctx = await authed("helpful", { max: 120, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const { data: existing } = await ctx.sb.from("review_helpful").select("id").eq("review_id", reviewId).eq("user_id", ctx.user.id).maybeSingle()
  const { error } = existing
    ? await ctx.sb.from("review_helpful").delete().eq("id", existing.id)
    : await ctx.sb.from("review_helpful").insert({ review_id: reviewId, user_id: ctx.user.id })
  if (error) return fail(error.message.includes("own review") ? "You can't vote on your own review." : "Could not update.")
  revalidatePath(`/apps/${slug}`)
  return { ok: true, data: { helpful: !existing } }
}

const reportSchema = z.object({
  appId: z.string().uuid().optional(),
  reviewId: z.string().uuid().optional(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().max(1000).optional(),
})

export async function submitReport(input: z.infer<typeof reportSchema>): Promise<ActionResult> {
  const parsed = reportSchema.safeParse(input)
  if (!parsed.success || (!parsed.data.appId && !parsed.data.reviewId)) return fail("Invalid report.")
  const ctx = await authed("report", { max: 8, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const { error } = await ctx.sb.from("reports").insert({
    user_id: ctx.user.id, app_id: parsed.data.appId ?? null, review_id: parsed.data.reviewId ?? null,
    reason: parsed.data.reason, details: cleanText(parsed.data.details, 1000) || null,
  })
  if (error) return fail("Could not submit your report.")
  return { ok: true, message: "Thanks. Our moderators will take a look." }
}

/** Only the verified owner of the reviewed app can respond (enforced again by RLS). */
export async function respondToReview(reviewId: string, body: string, slug: string): Promise<ActionResult> {
  const text = cleanText(body, 2000)
  if (text.length < 2) return fail("Write a response first.")
  const ctx = await authed("response", { max: 30, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const { data: existing } = await ctx.sb.from("developer_responses").select("id").eq("review_id", reviewId).maybeSingle()
  const { error } = existing
    ? await ctx.sb.from("developer_responses").update({ body: text }).eq("id", existing.id)
    : await ctx.sb.from("developer_responses").insert({ review_id: reviewId, developer_id: ctx.user.id, body: text })
  if (error) return fail("You can only respond to reviews of apps you've verified ownership of.")
  revalidatePath(`/apps/${slug}`)
  return { ok: true, message: "Response posted." }
}

export async function toggleFavorite(appId: string): Promise<ActionResult<{ saved: boolean }>> {
  const ctx = await authed("favorite", { max: 120, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const { data: existing } = await ctx.sb.from("favorites").select("id").eq("app_id", appId).eq("user_id", ctx.user.id).maybeSingle()
  const { error } = existing
    ? await ctx.sb.from("favorites").delete().eq("id", existing.id)
    : await ctx.sb.from("favorites").insert({ app_id: appId, user_id: ctx.user.id })
  if (error) return fail("Could not update your saved apps.")
  if (!existing) await recordEvent({ appId, type: "favorite", userId: ctx.user.id })
  revalidatePath("/saved")
  return { ok: true, data: { saved: !existing } }
}

/** Removing stars is independent of removing written feedback. */
export async function deleteRating(appId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(appId).success) return fail("Invalid app.")
  const ctx = await authed("rating-delete", { max: 30, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const app = await appMeta(ctx.sb, appId)
  const { error } = await ctx.sb.from("ratings").delete().eq("app_id", appId).eq("user_id", ctx.user.id)
  if (error) return fail("Could not remove rating.")
  if (app) revalidatePath(`/apps/${app.slug}`)
  return { ok: true, message: "Rating removed. Your review text is unchanged." }
}
