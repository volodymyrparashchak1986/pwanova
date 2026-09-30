"use server"

import { z } from "zod"
import { authed, fail, featureOn } from "./common"
import { actionLocale, msg } from "./messages"
import { getMatchCandidates } from "@/lib/data/catalog"
import { showDemoData } from "@/lib/env"
import { revalidateLocalized } from "@/lib/revalidate"
import { cleanText } from "@/lib/security/sanitize"
import { createAdminClient } from "@/lib/supabase/admin"
import { asJson } from "@/lib/supabase/rpc"
import { containsContactDetails, matchRequest, type RequestCriteria } from "@/lib/v2/matching"
import type { ActionResult } from "@/lib/types"

/**
 * Buyer requests. The requirements and the person are stored apart: contact details live in their own
 * table that only the buyer can read, and they reach a vendor only through share_contact(), which
 * records the buyer's consent and its exact wording. No plan, no role and no code path here can read them.
 */
const uuid = z.string().uuid()
const slug = z.string().regex(/^[a-z0-9-]{2,60}$/)
const lines = (max: number) => z.array(z.string().trim().min(2).max(200)).max(max).default([])

const requestSchema = z.object({
  title: z.string().trim().min(8).max(140),
  problem: z.string().trim().min(20).max(3000),
  teamSize: z.enum(["1", "2-10", "11-50", "51-200", "201-1000", "1000+"]).nullable().default(null),
  countryCode: z.string().regex(/^[A-Z]{2}$/).nullable().default(null),
  languages: z.array(z.string().regex(/^[a-z]{2}$/)).max(10).default([]),
  budgetMax: z.number().min(0).max(10_000_000).nullable().default(null),
  budgetCurrency: z.enum(["EUR", "USD", "GBP", "CHF"]).default("EUR"),
  budgetPerUser: z.boolean().default(false),
  budgetInterval: z.enum(["month", "year", "one_time"]).nullable().default(null),
  categories: z.array(slug).max(5).default([]),
  useCases: z.array(slug).max(8).default([]),
  requiredFacts: z.array(z.string().regex(/^[a-z][a-z0-9_]{1,60}$/)).max(12).default([]),
  requiredIntegrations: z.array(slug).max(10).default([]),
  requiredPlatforms: z.array(z.enum(["web", "pwa", "ios", "android", "macos", "windows", "linux", "browser_extension"])).max(8).default([]),
  mustHave: lines(10),
  niceToHave: lines(10),
  timeframe: z.enum(["asap", "1-3-months", "3-6-months", "exploring"]).nullable().default(null),
  visibility: z.enum(["private", "public"]).default("private"),
  contact: z.object({
    name: z.string().trim().max(120).optional(),
    email: z.string().trim().max(254).optional(),
    company: z.string().trim().max(160).optional(),
    phone: z.string().trim().max(40).optional(),
  }).default({}),
})
export type RequestInput = z.input<typeof requestSchema>

type Row = { id: string; public_id: string; category_slugs: string[]; use_case_slugs: string[]; languages: string[]; required_facts: string[]; required_integrations: string[]; required_platforms: string[]; budget_max_cents: number | null; budget_currency: string }

const criteria = (r: Row): RequestCriteria => ({
  categorySlugs: r.category_slugs, useCaseSlugs: r.use_case_slugs, languages: r.languages, requiredFacts: r.required_facts,
  requiredIntegrations: r.required_integrations, requiredPlatforms: r.required_platforms, budgetMaxCents: r.budget_max_cents, budgetCurrency: r.budget_currency,
})

/** Recomputes the short list of one request. Written by the service role; the matcher itself is a pure function. */
async function writeMatches(request: Row): Promise<number> {
  const admin = createAdminClient()
  if (!admin) return 0
  const apps = await getMatchCandidates(admin, request.category_slugs, request.use_case_slugs)
  const matches = matchRequest(apps, criteria(request), { includeDemo: showDemoData })
  await admin.from("buyer_request_matches").delete().eq("request_id", request.id)
  if (matches.length) {
    const { error } = await admin.from("buyer_request_matches").insert(matches.map((m, i) => ({
      request_id: request.id, app_id: m.appId, rank: i + 1, score: m.score, reasons: asJson({ met: m.met, total: m.total, requirements: m.requirements }),
    })))
    if (error) { console.error("writeMatches", error.message); return 0 }
  }
  await admin.from("buyer_requests").update({ status: matches.length ? "matched" : "open" }).eq("id", request.id).in("status", ["open", "matched"])
  return matches.length
}

export async function createRequest(input: RequestInput): Promise<ActionResult<{ id: string; matches: number }>> {
  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) return fail(await msg("invalid"))
  const ctx = await authed("request", { max: 5, windowSeconds: 86400 })
  if (!ctx.ok) return fail(ctx.error)
  if (!(await featureOn(ctx.sb, "requests"))) return fail(await msg("featureOff"))
  const v = parsed.data
  const title = cleanText(v.title, 140), problem = cleanText(v.problem, 3000)
  const mustHave = v.mustHave.map((l) => cleanText(l, 200)).filter(Boolean), niceToHave = v.niceToHave.map((l) => cleanText(l, 200)).filter(Boolean)
  // the requirements may become visible to vendors or to everybody: they must not identify the person
  if ([title, problem, ...mustHave, ...niceToHave].some(containsContactDetails)) return fail(await msg("contactInText"))

  const { data: row, error } = await ctx.sb.from("buyer_requests").insert({
    user_id: ctx.user.id, title, problem, locale: await actionLocale(), team_size: v.teamSize, country_code: v.countryCode, languages: v.languages,
    budget_max_cents: v.budgetMax === null ? null : Math.round(v.budgetMax * 100), budget_currency: v.budgetCurrency, budget_per_user: v.budgetPerUser,
    budget_interval: v.budgetInterval, category_slugs: v.categories, use_case_slugs: v.useCases, required_facts: v.requiredFacts,
    required_integrations: v.requiredIntegrations, required_platforms: v.requiredPlatforms, must_have: mustHave, nice_to_have: niceToHave,
    timeframe: v.timeframe, visibility: v.visibility,
  }).select("id, public_id, category_slugs, use_case_slugs, languages, required_facts, required_integrations, required_platforms, budget_max_cents, budget_currency").single()
  if (error || !row) return fail(await msg(error?.message.includes("Rate limit") ? "tooFast" : "failed"))

  const c = v.contact
  const contact = { contact_name: cleanText(c.name, 120) || null, contact_email: cleanText(c.email, 254).toLowerCase() || null, company_name: cleanText(c.company, 160) || null, phone: cleanText(c.phone, 40) || null }
  if (contact.contact_email && !z.string().email().safeParse(contact.contact_email).success) contact.contact_email = null
  if (Object.values(contact).some(Boolean)) {
    const { error: contactError } = await ctx.sb.from("buyer_request_contacts").insert({ request_id: row.id, user_id: ctx.user.id, ...contact })
    if (contactError) console.error("createRequest: contact not saved", contactError.message)
  }

  const matches = await writeMatches(row as Row)
  revalidateLocalized("/requests", `/requests/${row.public_id}`)
  return { ok: true, data: { id: row.public_id, matches } }
}

async function ownRequest(ctx: Extract<Awaited<ReturnType<typeof authed>>, { ok: true }>, publicId: string) {
  if (!/^[a-z0-9]{6,20}$/.test(publicId)) return null
  const { data } = await ctx.sb.from("buyer_requests")
    .select("id, public_id, user_id, status, category_slugs, use_case_slugs, languages, required_facts, required_integrations, required_platforms, budget_max_cents, budget_currency")
    .eq("public_id", publicId).maybeSingle()
  return data && data.user_id === ctx.user.id ? data : null
}

export async function rematchRequest(publicId: string): Promise<ActionResult<{ matches: number }>> {
  const ctx = await authed("request-match", { max: 12, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const request = await ownRequest(ctx, publicId)
  if (!request) return fail(await msg("notFound"))
  if (request.status === "closed" || request.status === "hidden") return fail(await msg("notAllowed"))
  const matches = await writeMatches(request as Row)
  revalidateLocalized(`/requests/${publicId}`)
  return { ok: true, data: { matches } }
}

export async function setRequestStatus(publicId: string, status: "closed" | "open"): Promise<ActionResult> {
  if (status !== "closed" && status !== "open") return fail(await msg("invalid"))
  const ctx = await authed("request-status", { max: 20, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const request = await ownRequest(ctx, publicId)
  if (!request) return fail(await msg("notFound"))
  const { error } = await ctx.sb.from("buyer_requests").update({ status }).eq("id", request.id)
  if (error) return fail(await msg("failed"))
  if (status === "open") await writeMatches(request as Row)
  revalidateLocalized("/requests", `/requests/${publicId}`, "/dashboard/requests")
  return { ok: true, message: await msg("done") }
}

// ------------------------------------------------------------------ vendor side
const respondSchema = z.object({ requestId: uuid, appId: uuid, message: z.string().trim().max(2000).optional() })

/** A verified owner of a matched listing says they are interested. They still do not learn who the buyer is. */
export async function respondToRequest(input: z.input<typeof respondSchema>): Promise<ActionResult> {
  const parsed = respondSchema.safeParse(input)
  if (!parsed.success) return fail(await msg("invalid"))
  const ctx = await authed("request-respond", { max: 30, windowSeconds: 86400 })
  if (!ctx.ok) return fail(ctx.error)
  const v = parsed.data
  const { data: app } = await ctx.sb.from("apps").select("id, developer_id, ownership_status").eq("id", v.appId).maybeSingle()
  if (!app || app.developer_id !== ctx.user.id) return fail(await msg("ownApp"))
  if (app.ownership_status !== "verified_owner") return fail(await msg("verifiedOwnerOnly"))
  const { data: entitled } = await ctx.sb.rpc("feature_enabled", { p_key: "buyer_requests.respond", p_app_id: app.id })
  if (!entitled) return fail(await msg("notEntitled"))
  const text = cleanText(v.message, 2000)
  if (text && containsContactDetails(text)) return fail(await msg("contactInText"))

  const { error } = await ctx.sb.from("buyer_request_responses").insert({ request_id: v.requestId, app_id: app.id, vendor_user_id: ctx.user.id, message: text || null })
  if (error) return fail(await msg(error.code === "23505" ? "alreadyResponded" : error.message.includes("plan") ? "notEntitled" : "failed"))

  // the buyer is told in the app; the notification carries no vendor message and no personal data
  const admin = createAdminClient()
  if (admin) {
    const { data: request } = await admin.from("buyer_requests").select("user_id, public_id").eq("id", v.requestId).maybeSingle()
    if (request) await admin.from("notifications").insert({ user_id: request.user_id, kind: "request_response", link: `/requests/${request.public_id}`, app_id: app.id, metadata: {} })
  }
  revalidateLocalized("/dashboard/requests")
  return { ok: true, message: await msg("saved") }
}

export async function withdrawResponse(responseId: string): Promise<ActionResult> {
  if (!uuid.safeParse(responseId).success) return fail(await msg("invalid"))
  const ctx = await authed("request-withdraw", { max: 30, windowSeconds: 86400 })
  if (!ctx.ok) return fail(ctx.error)
  const { error } = await ctx.sb.from("buyer_request_responses").update({ status: "withdrawn" }).eq("id", responseId).eq("vendor_user_id", ctx.user.id)
  if (error) return fail(await msg("failed"))
  revalidateLocalized("/dashboard/requests")
  return { ok: true, message: await msg("done") }
}

// ------------------------------------------------------------------ consent
const shareSchema = z.object({
  responseId: uuid,
  fields: z.array(z.enum(["contact_name", "contact_email", "company_name", "phone", "note"])).min(1).max(5),
  consentText: z.string().trim().min(20).max(600),
  publicId: z.string().regex(/^[a-z0-9]{6,20}$/),
})

/** The buyer shares the chosen details with one vendor. The database records who agreed to which wording, and when. */
export async function shareContact(input: z.input<typeof shareSchema>): Promise<ActionResult> {
  const parsed = shareSchema.safeParse(input)
  if (!parsed.success) return fail(await msg(parsed.error.issues[0]?.path[0] === "fields" ? "consent" : "invalid"))
  const ctx = await authed("contact-share", { max: 20, windowSeconds: 86400 })
  if (!ctx.ok) return fail(ctx.error)
  const v = parsed.data
  const { error } = await ctx.sb.rpc("share_contact", { p_response_id: v.responseId, p_fields: [...new Set(v.fields)], p_consent_text: cleanText(v.consentText, 600) })
  if (error) return fail(await msg("failed"))
  revalidateLocalized(`/requests/${v.publicId}`, "/dashboard/requests")
  return { ok: true, message: await msg("done") }
}

export async function revokeContact(responseId: string, publicId: string): Promise<ActionResult> {
  if (!uuid.safeParse(responseId).success || !/^[a-z0-9]{6,20}$/.test(publicId)) return fail(await msg("invalid"))
  const ctx = await authed("contact-revoke", { max: 20, windowSeconds: 86400 })
  if (!ctx.ok) return fail(ctx.error)
  const { error } = await ctx.sb.rpc("revoke_contact", { p_response_id: responseId })
  if (error) return fail(await msg("failed"))
  revalidateLocalized(`/requests/${publicId}`, "/dashboard/requests")
  return { ok: true, message: await msg("done") }
}

export async function declineResponse(responseId: string, publicId: string): Promise<ActionResult> {
  if (!uuid.safeParse(responseId).success || !/^[a-z0-9]{6,20}$/.test(publicId)) return fail(await msg("invalid"))
  const ctx = await authed("response-decline", { max: 40, windowSeconds: 86400 })
  if (!ctx.ok) return fail(ctx.error)
  const request = await ownRequest(ctx, publicId)
  if (!request) return fail(await msg("notFound"))
  const { error } = await ctx.sb.from("buyer_request_responses").update({ status: "declined" }).eq("id", responseId).eq("request_id", request.id)
  if (error) return fail(await msg("failed"))
  revalidateLocalized(`/requests/${publicId}`)
  return { ok: true, message: await msg("done") }
}

const contactSchema = z.object({
  publicId: z.string().regex(/^[a-z0-9]{6,20}$/),
  name: z.string().trim().max(120).optional(), email: z.string().trim().max(254).optional(), company: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(), note: z.string().trim().max(500).optional(),
})

/** The buyer's contact details for one request. Stored apart from the requirements; nobody else can read them. */
export async function saveRequestContact(input: z.input<typeof contactSchema>): Promise<ActionResult> {
  const parsed = contactSchema.safeParse(input)
  if (!parsed.success) return fail(await msg("invalid"))
  const ctx = await authed("request-contact", { max: 20, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const v = parsed.data
  const request = await ownRequest(ctx, v.publicId)
  if (!request) return fail(await msg("notFound"))
  const email = cleanText(v.email, 254).toLowerCase()
  if (email && !z.string().email().safeParse(email).success) return fail(await msg("email"))
  const row = {
    request_id: request.id, user_id: ctx.user.id, contact_name: cleanText(v.name, 120) || null, contact_email: email || null,
    company_name: cleanText(v.company, 160) || null, phone: cleanText(v.phone, 40) || null, note: cleanText(v.note, 500) || null,
  }
  const { error } = await ctx.sb.from("buyer_request_contacts").upsert(row, { onConflict: "request_id" })
  if (error) return fail(await msg("failed"))
  revalidateLocalized(`/requests/${v.publicId}`)
  return { ok: true, message: await msg("saved") }
}
