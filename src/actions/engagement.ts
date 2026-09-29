"use server"

import { z } from "zod"
import { appMeta, authed, fail } from "./common"
import { msg } from "./messages"
import { REPORT_REASONS } from "@/lib/constants"
import { recordEvent } from "@/lib/events"
import { revalidateLocalized } from "@/lib/revalidate"
import { cleanText } from "@/lib/security/sanitize"
import type { ActionResult } from "@/lib/types"

const ratingSchema = z.number().int().min(1).max(5)

/** One rating per user per app (unique app_id + user_id). Calling again changes it. */
export async function rateApp(appId: string, rating: number): Promise<ActionResult> {
  if (!ratingSchema.safeParse(rating).success) return fail(await msg("ratingRange"))
  const ctx = await authed("rating", { max: 40, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const app = await appMeta(ctx.sb, appId)
  if (!app) return fail(await msg("notFound"))
  if (app.developer_id === ctx.user.id) return fail(await msg("ownRate"))

  const { error } = await ctx.sb.from("ratings").upsert({ app_id: appId, user_id: ctx.user.id, rating }, { onConflict: "app_id,user_id" })
  if (error) return fail(await msg("failed"))
  await recordEvent({ appId, type: "rating", userId: ctx.user.id, metadata: { rating } })
  revalidateLocalized(`/apps/${app.slug}`)
  return { ok: true, message: await msg("ratingSaved") }
}

const reviewSchema = z.object({
  rating: ratingSchema,
  title: z.string().max(100).optional(),
  body: z.string().min(10).max(3000),
})

export async function saveReview(appId: string, input: { rating: number; title?: string; body: string }): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(input)
  if (!parsed.success) return fail(await msg(parsed.error.issues[0]?.path[0] === "body" ? "reviewShort" : "ratingRange"))
  const ctx = await authed("review", { max: 15, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const app = await appMeta(ctx.sb, appId)
  if (!app) return fail(await msg("notFound"))
  if (app.developer_id === ctx.user.id) return fail(await msg("ownReview"))

  const { data: existing } = await ctx.sb.from("reviews").select("id").eq("app_id", appId).eq("user_id", ctx.user.id).maybeSingle()
  const row = { app_id: appId, user_id: ctx.user.id, rating: parsed.data.rating, title: cleanText(parsed.data.title, 100) || null, body: cleanText(parsed.data.body, 3000) }
  const { error } = existing
    ? await ctx.sb.from("reviews").update({ rating: row.rating, title: row.title, body: row.body }).eq("id", existing.id)
    : await ctx.sb.from("reviews").insert(row)
  if (error) return fail(await msg(error.message.includes("Rate limit") ? "reviewLimit" : "failed"))
  if (!existing) await recordEvent({ appId, type: "review", userId: ctx.user.id })
  revalidateLocalized(`/apps/${app.slug}`)
  return { ok: true, message: await msg(existing ? "reviewUpdated" : "reviewPosted") }
}

export async function deleteReview(appId: string): Promise<ActionResult> {
  const ctx = await authed("review-delete", { max: 30, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const app = await appMeta(ctx.sb, appId)
  const { error } = await ctx.sb.from("reviews").delete().eq("app_id", appId).eq("user_id", ctx.user.id)
  if (error) return fail(await msg("failed"))
  if (app) revalidateLocalized(`/apps/${app.slug}`)
  return { ok: true, message: await msg("reviewDeleted") }
}

export async function toggleHelpful(reviewId: string, slug: string): Promise<ActionResult<{ helpful: boolean }>> {
  const ctx = await authed("helpful", { max: 120, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const { data: existing } = await ctx.sb.from("review_helpful").select("id").eq("review_id", reviewId).eq("user_id", ctx.user.id).maybeSingle()
  const { error } = existing
    ? await ctx.sb.from("review_helpful").delete().eq("id", existing.id)
    : await ctx.sb.from("review_helpful").insert({ review_id: reviewId, user_id: ctx.user.id })
  if (error) return fail(await msg(error.message.includes("own review") ? "ownVote" : "failed"))
  revalidateLocalized(`/apps/${slug}`)
  return { ok: true, data: { helpful: !existing } }
}

const reportSchema = z.object({
  appId: z.string().uuid().optional(),
  reviewId: z.string().uuid().optional(),
  evidenceId: z.string().uuid().optional(),
  launchId: z.string().uuid().optional(),
  requestId: z.string().uuid().optional(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().max(1000).optional(),
})
export type ReportInput = z.infer<typeof reportSchema>

/** Reports an app, a review, a piece of evidence, a launch or a request. Moderators read every report. */
export async function submitReport(input: ReportInput): Promise<ActionResult> {
  const parsed = reportSchema.safeParse(input)
  const v = parsed.data
  if (!parsed.success || !v || !(v.appId || v.reviewId || v.evidenceId || v.launchId || v.requestId)) return fail(await msg("invalid"))
  const ctx = await authed("report", { max: 8, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const { error } = await ctx.sb.from("reports").insert({
    user_id: ctx.user.id, app_id: v.appId ?? null, review_id: v.reviewId ?? null, evidence_id: v.evidenceId ?? null,
    launch_id: v.launchId ?? null, request_id: v.requestId ?? null, reason: v.reason, details: cleanText(v.details, 1000) || null,
  })
  if (error) return fail(await msg("failed"))
  return { ok: true, message: await msg("reportThanks") }
}

/** Only the verified owner of the reviewed app can respond (enforced again by RLS). */
export async function respondToReview(reviewId: string, body: string, slug: string): Promise<ActionResult> {
  const text = cleanText(body, 2000)
  if (text.length < 2) return fail(await msg("responseShort"))
  const ctx = await authed("response", { max: 30, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const { data: existing } = await ctx.sb.from("developer_responses").select("id").eq("review_id", reviewId).maybeSingle()
  const { error } = existing
    ? await ctx.sb.from("developer_responses").update({ body: text }).eq("id", existing.id)
    : await ctx.sb.from("developer_responses").insert({ review_id: reviewId, developer_id: ctx.user.id, body: text })
  if (error) return fail(await msg("respondOwnerOnly"))
  revalidateLocalized(`/apps/${slug}`)
  return { ok: true, message: await msg("responsePosted") }
}

export async function toggleFavorite(appId: string): Promise<ActionResult<{ saved: boolean }>> {
  const ctx = await authed("favorite", { max: 120, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const { data: existing } = await ctx.sb.from("favorites").select("id").eq("app_id", appId).eq("user_id", ctx.user.id).maybeSingle()
  const { error } = existing
    ? await ctx.sb.from("favorites").delete().eq("id", existing.id)
    : await ctx.sb.from("favorites").insert({ app_id: appId, user_id: ctx.user.id })
  if (error) return fail(await msg("failed"))
  if (!existing) await recordEvent({ appId, type: "favorite", userId: ctx.user.id })
  revalidateLocalized("/saved")
  return { ok: true, data: { saved: !existing } }
}

/** Removing stars is independent of removing written feedback. */
export async function deleteRating(appId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(appId).success) return fail(await msg("invalid"))
  const ctx = await authed("rating-delete", { max: 30, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const app = await appMeta(ctx.sb, appId)
  const { error } = await ctx.sb.from("ratings").delete().eq("app_id", appId).eq("user_id", ctx.user.id)
  if (error) return fail(await msg("failed"))
  if (app) revalidateLocalized(`/apps/${app.slug}`)
  return { ok: true, message: await msg("ratingRemoved") }
}
