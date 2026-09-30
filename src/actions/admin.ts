"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { authed, fail, roleOf } from "./common"
import { cleanHttpUrl, cleanText } from "@/lib/security/sanitize"
import { asJson, nullable } from "@/lib/supabase/rpc"
import { verifyApp } from "@/lib/v2/verify/engine"
import type { ActionResult } from "@/lib/types"

/**
 * Moderator and admin tools. The role is read from the database for every call and checked again by
 * the database functions themselves, which also write the audit trail (who, when, previous and new value,
 * reason). The admin area is English only.
 */
const uuid = z.string().uuid()
const reason = z.string().trim().max(500)

type Ctx = Extract<Awaited<ReturnType<typeof authed>>, { ok: true }>
async function staff(action: string, need: "moderator" | "admin"): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const ctx = await authed(action, { max: 300, windowSeconds: 3600 })
  if (!ctx.ok) return { ok: false, error: ctx.error }
  const role = await roleOf(ctx.sb, ctx.user.id)
  if (role !== "admin" && !(need === "moderator" && role === "moderator")) return { ok: false, error: need === "admin" ? "Admin access required." : "Moderator access required." }
  return { ok: true, ctx }
}
const done = (message = "Done."): ActionResult => { revalidatePath("/", "layout"); return { ok: true, message } }
const dbError = (e: { message: string }) => fail(/reason is required/i.test(e.message) ? "A reason of at least three characters is required. It is recorded in the audit log." : e.message.slice(0, 200))

// ------------------------------------------------------------------ listings, reviews, reports (v1 moderate())
const moderateSchema = z.object({
  kind: z.enum(["approve", "reject", "hide", "suspend", "restore", "verify", "unverify", "feature", "unfeature", "remove_review", "resolve_report", "dismiss_report"]),
  id: uuid,
  reason: reason.optional(),
})

export async function adminAction(input: z.infer<typeof moderateSchema>): Promise<ActionResult> {
  const parsed = moderateSchema.safeParse(input)
  if (!parsed.success) return fail("Invalid action.")
  const moderatorKinds = ["remove_review", "resolve_report", "dismiss_report"]
  const s = await staff("admin", moderatorKinds.includes(parsed.data.kind) ? "moderator" : "admin")
  if (!s.ok) return fail(s.error)
  const { kind, id } = parsed.data
  const { error } = await s.ctx.sb.rpc("moderate", { p_kind: kind, p_id: id, p_reason: cleanText(parsed.data.reason, 500) || undefined })
  if (error) return fail("Action failed. A reason is required for hiding, rejecting, suspending or removing content.")
  return done()
}

const reassignSchema = z.object({ appId: uuid, targetUsername: z.string().min(3).max(32), reason })

/**
 * Dispute resolution: moving a verified listing to another account is not part of the claim flow.
 * This logged, admin-only action is the only way, and ownership has to be verified again afterwards.
 */
export async function reassignOwner(input: z.infer<typeof reassignSchema>): Promise<ActionResult> {
  const parsed = reassignSchema.safeParse(input)
  if (!parsed.success) return fail("Enter the target username and a reason.")
  const s = await staff("admin-reassign", "admin")
  if (!s.ok) return fail(s.error)
  const { error } = await s.ctx.sb.rpc("reassign_app_owner", { p_app_id: parsed.data.appId, p_username: parsed.data.targetUsername.toLowerCase(), p_reason: cleanText(parsed.data.reason, 500) })
  if (error) return fail("Reassignment failed. Check the username and give a reason.")
  return done("Owner reassigned. Ownership has to be verified again.")
}

export async function revokeOwnership(appId: string, why: string): Promise<ActionResult> {
  if (!uuid.safeParse(appId).success) return fail("Invalid app.")
  const s = await staff("admin-revoke", "admin")
  if (!s.ok) return fail(s.error)
  const { error } = await s.ctx.sb.rpc("revoke_ownership", { p_app_id: appId, p_reason: cleanText(why, 500) })
  return error ? dbError(error) : done("Ownership revoked. The former owner's statements no longer count.")
}

const mergeSchema = z.object({ duplicateId: uuid, targetSlug: z.string().regex(/^[a-z0-9-]{1,80}$/), reason })
export async function mergeDuplicate(input: z.infer<typeof mergeSchema>): Promise<ActionResult> {
  const parsed = mergeSchema.safeParse(input)
  if (!parsed.success) return fail("Enter the slug of the listing that stays and a reason.")
  const s = await staff("admin-merge", "admin")
  if (!s.ok) return fail(s.error)
  const { data: target } = await s.ctx.sb.from("apps").select("id").eq("slug", parsed.data.targetSlug).maybeSingle()
  if (!target) return fail("No listing with that slug.")
  const { error } = await s.ctx.sb.rpc("merge_duplicate_app", { p_duplicate_id: parsed.data.duplicateId, p_target_id: target.id, p_reason: cleanText(parsed.data.reason, 500) })
  return error ? dbError(error) : done("Merged. The old address redirects to the listing that stayed.")
}

// ------------------------------------------------------------------ evidence
const reviewSchema = z.object({ evidenceId: uuid, decision: z.enum(["approve", "reject", "retract"]), note: reason })
export async function reviewEvidence(input: z.infer<typeof reviewSchema>): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(input)
  if (!parsed.success) return fail("Invalid decision.")
  const s = await staff("admin-evidence", "moderator")
  if (!s.ok) return fail(s.error)
  const { error } = await s.ctx.sb.rpc("review_evidence", { p_evidence_id: parsed.data.evidenceId, p_decision: parsed.data.decision, p_note: cleanText(parsed.data.note, 500) })
  return error ? dbError(error) : done()
}

const factSchema = z.object({
  appId: uuid, key: z.string().regex(/^[a-z][a-z0-9_]{1,60}$/), state: z.enum(["yes", "no", "unknown"]),
  value: z.string().max(500).optional(), sourceUrl: z.string().max(500).optional(), sourceTitle: z.string().max(200).optional(),
  excerpt: z.string().max(1000).optional(), reason,
})
/** A moderator read the source and records the answer as "reviewed by PWANova". "unknown" withdraws the reviewed answer. */
export async function adminSetFact(input: z.infer<typeof factSchema>): Promise<ActionResult> {
  const parsed = factSchema.safeParse(input)
  if (!parsed.success) return fail("Check the fields.")
  const s = await staff("admin-fact", "moderator")
  if (!s.ok) return fail(s.error)
  const v = parsed.data
  const source = cleanHttpUrl(v.sourceUrl)
  if (v.state !== "unknown" && !source) return fail("A reviewed answer needs the address of the source that was read.")
  const { error } = await s.ctx.sb.rpc("admin_set_fact", {
    p_app_id: v.appId, p_key: v.key, p_state: v.state, p_value: nullable(cleanText(v.value, 500) || null), p_source_url: nullable(source),
    p_source_title: nullable(cleanText(v.sourceTitle, 200) || null), p_excerpt: nullable(cleanText(v.excerpt, 1000) || null), p_reason: cleanText(v.reason, 500),
  })
  return error ? dbError(error) : done()
}

/** Runs the automatic checks for one listing now. The run is recorded like a scheduled one. */
export async function runVerification(appId: string): Promise<ActionResult> {
  if (!uuid.safeParse(appId).success) return fail("Invalid app.")
  const s = await staff("admin-verify", "moderator")
  if (!s.ok) return fail(s.error)
  const run = await verifyApp(appId, "manual", s.ctx.user.id, 25_000)
  if (!run.ok) return fail(run.error ?? "The run failed.")
  return done(`Checked ${run.checked} items, ${run.found} found.`)
}

// ------------------------------------------------------------------ launches and requests
const launchSchema = z.object({ launchId: uuid, decision: z.enum(["approve", "reject"]), note: reason.optional() })
export async function decideLaunch(input: z.infer<typeof launchSchema>): Promise<ActionResult> {
  const parsed = launchSchema.safeParse(input)
  if (!parsed.success) return fail("Invalid decision.")
  const s = await staff("admin-launch", "moderator")
  if (!s.ok) return fail(s.error)
  const { error } = await s.ctx.sb.rpc("decide_launch", { p_launch_id: parsed.data.launchId, p_decision: parsed.data.decision, p_note: cleanText(parsed.data.note, 500) || undefined })
  return error ? dbError(error) : done()
}

const requestSchema = z.object({ requestId: uuid, decision: z.enum(["hide", "restore", "close"]), note: reason })
export async function moderateRequest(input: z.infer<typeof requestSchema>): Promise<ActionResult> {
  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) return fail("Invalid decision.")
  const s = await staff("admin-request", "moderator")
  if (!s.ok) return fail(s.error)
  const { error } = await s.ctx.sb.rpc("moderate_request", { p_request_id: parsed.data.requestId, p_decision: parsed.data.decision, p_note: cleanText(parsed.data.note, 500) })
  return error ? dbError(error) : done()
}

// ------------------------------------------------------------------ plans
const grantSchema = z.object({ username: z.string().min(3).max(32), plan: z.string().regex(/^[a-z0-9-]{2,40}$/), appSlug: z.string().regex(/^[a-z0-9-]{0,80}$/).optional(), endsAt: z.string().optional(), note: reason })
/** Entitlements are granted by an admin. There is no payment provider: nothing is charged by this action. */
export async function grantEntitlement(input: z.infer<typeof grantSchema>): Promise<ActionResult> {
  const parsed = grantSchema.safeParse(input)
  if (!parsed.success) return fail("Check the fields.")
  const s = await staff("admin-grant", "admin")
  if (!s.ok) return fail(s.error)
  const v = parsed.data
  let appId: string | null = null
  if (v.appSlug) {
    const { data: app } = await s.ctx.sb.from("apps").select("id").eq("slug", v.appSlug).maybeSingle()
    if (!app) return fail("No listing with that slug.")
    appId = app.id
  }
  const ends = v.endsAt ? new Date(v.endsAt) : null
  if (ends && Number.isNaN(ends.getTime())) return fail("Invalid end date.")
  const { error } = await s.ctx.sb.rpc("grant_entitlement", { p_username: v.username.toLowerCase(), p_plan: v.plan, p_app_id: nullable(appId), p_ends_at: nullable(ends?.toISOString() ?? null), p_note: cleanText(v.note, 500) })
  return error ? dbError(error) : done("Entitlement granted.")
}

export async function revokeEntitlement(id: string, why: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return fail("Invalid entitlement.")
  const s = await staff("admin-revoke-plan", "admin")
  if (!s.ok) return fail(s.error)
  const { error } = await s.ctx.sb.rpc("revoke_entitlement", { p_id: id, p_reason: cleanText(why, 500) })
  return error ? dbError(error) : done("Entitlement revoked.")
}

// ------------------------------------------------------------------ settings
const featuresSchema = z.object({ launches: z.boolean(), requests: z.boolean(), compare: z.boolean(), newsletter: z.boolean(), sponsorship: z.boolean() })
export async function saveFeatures(input: z.infer<typeof featuresSchema>): Promise<ActionResult> {
  const parsed = featuresSchema.safeParse(input)
  if (!parsed.success) return fail("Invalid settings.")
  const s = await staff("admin-settings", "admin")
  if (!s.ok) return fail(s.error)
  const { error } = await s.ctx.sb.from("site_settings").update({ value: asJson(parsed.data), updated_by: s.ctx.user.id, updated_at: new Date().toISOString() }).eq("key", "features")
  return error ? fail("Could not save the settings.") : done("Settings saved.")
}

const operatorField = z.string().trim().max(200).optional().transform((v) => cleanText(v, 200) || null)
const operatorSchema = z.object({
  legal_name: operatorField, street: operatorField, postal_code: operatorField, city: operatorField, country: operatorField, email: operatorField, phone: operatorField,
  represented_by: operatorField, register: operatorField, vat_id: operatorField, responsible_for_content: operatorField,
})
/** The operator's details for the legal notice. They are published, so they are entered by the operator, never guessed. */
export async function saveOperator(input: z.input<typeof operatorSchema>): Promise<ActionResult> {
  const parsed = operatorSchema.safeParse(input)
  if (!parsed.success) return fail("Check the fields.")
  const s = await staff("admin-operator", "admin")
  if (!s.ok) return fail(s.error)
  const { error } = await s.ctx.sb.from("site_settings").update({ value: asJson(parsed.data), updated_by: s.ctx.user.id, updated_at: new Date().toISOString() }).eq("key", "operator")
  return error ? fail("Could not save the operator details.") : done("Operator details saved.")
}

// ------------------------------------------------------------------ sponsor campaigns
const campaignSchema = z.object({
  sponsorName: z.string().trim().min(1).max(120), appSlug: z.string().regex(/^[a-z0-9-]{1,80}$/), placement: z.enum(["home", "category", "discover", "launches"]),
  categorySlug: z.string().regex(/^[a-z0-9-]{0,60}$/).optional(), headlineEn: z.string().max(120).optional(), headlineDe: z.string().max(120).optional(),
  startsAt: z.string(), endsAt: z.string(),
})
/** A labelled placement for a listed app. It is shown apart from organic results and never changes their order. */
export async function createCampaign(input: z.infer<typeof campaignSchema>): Promise<ActionResult> {
  const parsed = campaignSchema.safeParse(input)
  if (!parsed.success) return fail("Check the fields.")
  const s = await staff("admin-sponsor", "admin")
  if (!s.ok) return fail(s.error)
  const v = parsed.data
  const starts = new Date(v.startsAt), ends = new Date(v.endsAt)
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) return fail("The end has to be after the start.")
  const { data: app } = await s.ctx.sb.from("apps").select("id").eq("slug", v.appSlug).eq("status", "published").maybeSingle()
  if (!app) return fail("No public listing with that slug.")
  let categoryId: string | null = null
  if (v.placement === "category") {
    const { data: category } = await s.ctx.sb.from("categories").select("id").eq("slug", v.categorySlug ?? "").maybeSingle()
    if (!category) return fail("A category placement needs a category.")
    categoryId = category.id
  }
  const { error } = await s.ctx.sb.from("sponsor_campaigns").insert({
    sponsor_name: cleanText(v.sponsorName, 120), app_id: app.id, placement: v.placement, category_id: categoryId,
    headline: asJson({ en: cleanText(v.headlineEn, 120), de: cleanText(v.headlineDe, 120) }), starts_at: starts.toISOString(), ends_at: ends.toISOString(),
    status: "draft", created_by: s.ctx.user.id,
  })
  return error ? fail("Could not create the campaign.") : done("Campaign created as a draft.")
}

export async function setCampaignStatus(id: string, status: "draft" | "active" | "paused" | "ended"): Promise<ActionResult> {
  if (!uuid.safeParse(id).success || !["draft", "active", "paused", "ended"].includes(status)) return fail("Invalid campaign.")
  const s = await staff("admin-sponsor", "admin")
  if (!s.ok) return fail(s.error)
  const { error } = await s.ctx.sb.from("sponsor_campaigns").update({ status }).eq("id", id)
  return error ? fail("Could not update the campaign.") : done()
}

const roleSchema = z.object({ username: z.string().min(3).max(32), role: z.enum(["user", "developer", "moderator"]) })
/** Moderators are appointed by an admin. Admins themselves are set in the database, not through the site. */
export async function setRole(input: z.infer<typeof roleSchema>): Promise<ActionResult> {
  const parsed = roleSchema.safeParse(input)
  if (!parsed.success) return fail("Check the fields.")
  const s = await staff("admin-role", "admin")
  if (!s.ok) return fail(s.error)
  const { data: profile } = await s.ctx.sb.from("profiles").select("id, role").eq("username", parsed.data.username.toLowerCase()).maybeSingle()
  if (!profile) return fail("No account with that username.")
  if (profile.role === "admin") return fail("An admin's role is not changed here.")
  const { error } = await s.ctx.sb.from("profiles").update({ role: parsed.data.role }).eq("id", profile.id)
  return error ? fail("Could not change the role.") : done(`Role set to ${parsed.data.role}.`)
}
