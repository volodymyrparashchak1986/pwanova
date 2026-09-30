"use server"

import { z } from "zod"
import { authed, createCompany, fail, featureOn } from "./common"
import { msg } from "./messages"
import { LOCALES } from "@/i18n/config"
import { revalidateLocalized } from "@/lib/revalidate"
import { cleanHttpUrl, cleanText } from "@/lib/security/sanitize"
import { slugify } from "@/lib/url"
import { NOT_STATEABLE } from "@/lib/v2/options"
import { verifyApp } from "@/lib/v2/verify/engine"
import type { ActionResult } from "@/lib/types"

/**
 * Everything a maker does to a listing they manage. Every write goes through the maker's own session,
 * so row level security decides what they may touch, and database triggers decide where a statement
 * comes from ("vendor stated" for a verified owner, "user submitted" otherwise). Nothing here can
 * mark anything as verified.
 */
const uuid = z.string().uuid()
const PRICING_MODELS = ["unknown", "free", "freemium", "subscription", "one_time", "usage_based", "open_source", "contact_sales"] as const
const PLATFORMS = ["web", "ios", "android", "macos", "windows", "linux", "browser_extension"] as const
const REGIONS = ["eu", "eea", "de", "ch", "uk", "us", "global", "other"] as const
const country = z.string().regex(/^[A-Z]{2}$/)
const optionalCountry = country.optional().or(z.literal("")).transform((v) => v || null)
const optionalText = (max: number) => z.string().max(max).optional().transform((v) => cleanText(v, max) || null)
const optionalLink = z.string().max(500).optional().transform((v) => cleanHttpUrl(v))

type Ctx = Extract<Awaited<ReturnType<typeof authed>>, { ok: true }>
type Managed = { id: string; slug: string; developer_id: string | null; ownership_status: string; company_id: string | null; name: string }

async function managed(ctx: Ctx, appId: string): Promise<Managed | null> {
  if (!uuid.safeParse(appId).success) return null
  const { data } = await ctx.sb.from("apps").select("id, slug, developer_id, ownership_status, company_id, name").eq("id", appId).maybeSingle()
  return data && data.developer_id === ctx.user.id ? (data as Managed) : null
}
const touch = (slug: string) => revalidateLocalized(`/apps/${slug}`, `/apps/${slug}/evidence`, `/dashboard/apps/${slug}`, "/dashboard")

// ------------------------------------------------------------------ product profile
const listingSchema = z.object({
  appId: uuid,
  tagline: z.string().trim().min(3).max(120),
  description: z.string().max(4000),
  contentLocale: z.enum(LOCALES),
  taglineDe: z.string().max(120).optional(),
  descriptionDe: z.string().max(4000).optional(),
  category: z.string().regex(/^[a-z0-9-]{2,60}$/),
  useCases: z.array(z.string().regex(/^[a-z0-9-]{2,60}$/)).max(5),
  pricingModel: z.enum(PRICING_MODELS),
  hasFreePlan: z.boolean().nullable(),
  hasFreeTrial: z.boolean().nullable(),
  startingPrice: z.number().min(0).max(1_000_000).nullable(),
  priceCurrency: z.enum(["EUR", "USD", "GBP", "CHF"]),
  languages: z.array(z.string().regex(/^[a-z]{2}$/)).max(20),
  platforms: z.array(z.enum(PLATFORMS)).max(7),
  integrations: z.array(z.string().regex(/^[a-z0-9-]{2,60}$/)).max(24),
  companyName: z.string().trim().max(120).optional(),
  companyCountry: optionalCountry,
  aliases: z.array(z.string().trim().min(2).max(60)).max(8).default([]),
})

/** Replaces the rows of a list the maker manages, leaving rows that PWANova observed or reviewed alone. */
async function syncList(ctx: Ctx, table: "app_languages" | "app_platforms", column: "language_code" | "platform", appId: string, wanted: string[]) {
  const { data: current } = await ctx.sb.from(table).select(`${column}, source_type`).eq("app_id", appId)
  const rows = (current ?? []) as unknown as Record<string, string>[]
  const own = rows.filter((r) => r.source_type === "vendor_stated" || r.source_type === "user_submitted")
  const remove = own.filter((r) => !wanted.includes(r[column])).map((r) => r[column])
  const add = wanted.filter((w) => !rows.some((r) => r[column] === w))
  if (remove.length) await ctx.sb.from(table).delete().eq("app_id", appId).in(column, remove)
  if (add.length) await ctx.sb.from(table).insert(add.map((value) => ({ app_id: appId, [column]: value })) as never)
}

export async function updateListing(input: z.input<typeof listingSchema>): Promise<ActionResult> {
  const parsed = listingSchema.safeParse(input)
  if (!parsed.success) return fail(await msg("invalid"))
  const ctx = await authed("listing", { max: 40, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const v = parsed.data
  const app = await managed(ctx, v.appId)
  if (!app) return fail(await msg("ownApp"))

  const { data: category } = await ctx.sb.from("categories").select("id").eq("slug", v.category).eq("is_active", true).maybeSingle()
  if (!category) return fail(await msg("invalid"))

  let companyId = app.company_id
  const companyName = cleanText(v.companyName, 120)
  if (companyName) {
    if (companyId) {
      const { error } = await ctx.sb.from("companies").update({ name: companyName, country_code: v.companyCountry }).eq("id", companyId)
      if (error) companyId = null // a company record somebody else created is not theirs to edit: they get their own
    }
    if (!companyId) companyId = await createCompany(ctx.sb, slugify(companyName), { name: companyName, country_code: v.companyCountry, created_by: ctx.user.id })
  }

  const { error } = await ctx.sb.from("apps").update({
    tagline: cleanText(v.tagline, 120), description: cleanText(v.description, 4000), content_locale: v.contentLocale,
    primary_category_id: category.id, pricing_model: v.pricingModel, has_free_plan: v.hasFreePlan, has_free_trial: v.hasFreeTrial,
    starting_price_cents: v.startingPrice === null ? null : Math.round(v.startingPrice * 100), price_currency: v.startingPrice === null ? null : v.priceCurrency,
    company_id: companyId, aliases: [...new Set(v.aliases.map((a) => cleanText(a, 60)).filter(Boolean))],
  }).eq("id", app.id)
  if (error) return fail(await msg("failed"))

  const taglineDe = cleanText(v.taglineDe, 120), descriptionDe = cleanText(v.descriptionDe, 4000)
  if (v.contentLocale !== "de" && (taglineDe || descriptionDe)) {
    await ctx.sb.from("app_translations").upsert({ app_id: app.id, locale: "de", tagline: taglineDe || null, description: descriptionDe || null, updated_by: ctx.user.id, updated_at: new Date().toISOString() }, { onConflict: "app_id,locale" })
  } else {
    await ctx.sb.from("app_translations").delete().eq("app_id", app.id).eq("locale", "de").eq("source", "maker")
  }

  await syncList(ctx, "app_languages", "language_code", app.id, [...new Set(v.languages)])
  await syncList(ctx, "app_platforms", "platform", app.id, [...new Set(v.platforms)].filter((p) => p !== "web"))

  const { data: useCases } = await ctx.sb.from("use_cases").select("id, slug").in("slug", v.useCases.length ? v.useCases : ["-"])
  await ctx.sb.from("app_use_cases").delete().eq("app_id", app.id)
  if (useCases?.length) await ctx.sb.from("app_use_cases").insert(useCases.map((u) => ({ app_id: app.id, use_case_id: u.id })))

  const { data: catalog } = await ctx.sb.from("integration_catalog").select("id, slug").in("slug", v.integrations.length ? v.integrations : ["-"])
  const { data: currentIntegrations } = await ctx.sb.from("app_integrations").select("integration_id, source_type").eq("app_id", app.id)
  const wanted = new Set((catalog ?? []).map((c) => c.id))
  const mine = (currentIntegrations ?? []).filter((c) => c.source_type === "vendor_stated" || c.source_type === "user_submitted")
  const drop = mine.filter((c) => !wanted.has(c.integration_id)).map((c) => c.integration_id)
  if (drop.length) await ctx.sb.from("app_integrations").delete().eq("app_id", app.id).in("integration_id", drop)
  const add = [...wanted].filter((id) => !(currentIntegrations ?? []).some((c) => c.integration_id === id))
  if (add.length) await ctx.sb.from("app_integrations").insert(add.map((integration_id) => ({ app_id: app.id, integration_id })))

  touch(app.slug)
  revalidateLocalized("/discover")
  return { ok: true, message: await msg("saved") }
}

// ------------------------------------------------------------------ statements (evidence)
const statementSchema = z.object({
  appId: uuid,
  attribute: z.string().regex(/^[a-z][a-z0-9_]{1,60}$/),
  state: z.enum(["yes", "no"]),
  value: optionalText(500),
  sourceUrl: optionalLink,
  excerpt: optionalText(1000),
})

/**
 * A statement about one fact. History is append-only: a new statement is a new row, and the previous
 * one stays visible as replaced. Facts whose value is a document need the document's address.
 */
export async function addStatement(input: z.input<typeof statementSchema>): Promise<ActionResult> {
  const parsed = statementSchema.safeParse(input)
  if (!parsed.success) return fail(await msg("invalid"))
  const ctx = await authed("statement", { max: 30, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const v = parsed.data
  const app = await managed(ctx, v.appId)
  if (!app) return fail(await msg("ownApp"))
  const { data: attr } = await ctx.sb.from("fact_attributes").select("key, value_type").eq("key", v.attribute).maybeSingle()
  if (!attr) return fail(await msg("invalid"))
  // derived from the company record or observed by PWANova at one address: not something to state by hand
  if ((NOT_STATEABLE as readonly string[]).includes(attr.key)) return fail(await msg("notAllowed"))
  if (attr.value_type === "url" && v.state === "yes" && !v.sourceUrl) return fail(await msg("sourceRequired"))

  const { error } = await ctx.sb.from("app_evidence").insert({
    app_id: app.id, attribute_key: attr.key, value_state: v.state,
    value_text: attr.value_type === "url" ? (v.state === "yes" ? v.sourceUrl : null) : v.value,
    source_url: v.sourceUrl, evidence_excerpt: v.excerpt,
    source_type: "user_submitted", verification_method: "community", // required columns; the database decides the real origin
  })
  if (error) return fail(await msg(error.message.includes("Rate limit") ? "tooFast" : "failed"))
  touch(app.slug)
  return { ok: true, message: await msg("saved") }
}

export async function retractStatement(evidenceId: string): Promise<ActionResult> {
  if (!uuid.safeParse(evidenceId).success) return fail(await msg("invalid"))
  const ctx = await authed("statement-retract", { max: 30, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const { data: row } = await ctx.sb.from("app_evidence").select("id, app_id, submitted_by, source_type, status").eq("id", evidenceId).maybeSingle()
  if (!row || row.submitted_by !== ctx.user.id || row.source_type !== "vendor_stated" || row.status !== "current") return fail(await msg("notAllowed"))
  const { error } = await ctx.sb.from("app_evidence").update({ status: "retracted" }).eq("id", evidenceId)
  if (error) return fail(await msg("failed"))
  const { data: app } = await ctx.sb.from("apps").select("slug").eq("id", row.app_id).maybeSingle()
  if (app) touch(app.slug)
  return { ok: true, message: await msg("done") }
}

// ------------------------------------------------------------------ pricing plans
const planSchema = z.object({
  appId: uuid,
  id: uuid.optional(),
  name: z.string().trim().min(1).max(60),
  billingInterval: z.enum(["free", "month", "year", "one_time", "usage", "custom"]),
  price: z.number().min(0).max(1_000_000).nullable(),
  currency: z.enum(["EUR", "USD", "GBP", "CHF"]),
  perUser: z.boolean(),
  description: optionalText(300),
  sourceUrl: optionalLink,
  sortOrder: z.number().int().min(0).max(1000).default(100),
})

export async function savePricingPlan(input: z.input<typeof planSchema>): Promise<ActionResult> {
  const parsed = planSchema.safeParse(input)
  if (!parsed.success) return fail(await msg("invalid"))
  const ctx = await authed("pricing", { max: 40, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const v = parsed.data
  const app = await managed(ctx, v.appId)
  if (!app) return fail(await msg("ownApp"))
  const free = v.billingInterval === "free"
  const row = {
    app_id: app.id, name: cleanText(v.name, 60), billing_interval: v.billingInterval, price_cents: free ? 0 : v.price === null ? null : Math.round(v.price * 100),
    currency: free || v.price !== null ? v.currency : null, per_user: v.perUser, description: v.description, source_url: v.sourceUrl, sort_order: v.sortOrder,
  }
  const { error } = v.id
    ? await ctx.sb.from("pricing_plans").update(row).eq("id", v.id).eq("app_id", app.id)
    : await ctx.sb.from("pricing_plans").insert(row)
  if (error) return fail(await msg("failed"))
  touch(app.slug)
  return { ok: true, message: await msg("saved") }
}

// ------------------------------------------------------------------ data locations, subprocessors, AI providers
const detailSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("data_location"), appId: uuid, region: z.enum(REGIONS), countryCode: optionalCountry, description: optionalText(300), isDefault: z.boolean().default(false), sourceUrl: optionalLink }),
  z.object({ kind: z.literal("subprocessor"), appId: uuid, name: z.string().trim().min(1).max(120), purpose: optionalText(200), countryCode: optionalCountry, sourceUrl: optionalLink }),
  z.object({ kind: z.literal("ai_provider"), appId: uuid, provider: z.string().trim().min(1).max(80), modelName: optionalText(120), purpose: optionalText(200), sourceUrl: optionalLink }),
  z.object({ kind: z.literal("alternative"), appId: uuid, name: z.string().trim().min(1).max(80), sourceUrl: optionalLink }),
])

export async function addDetail(input: z.input<typeof detailSchema>): Promise<ActionResult> {
  const parsed = detailSchema.safeParse(input)
  if (!parsed.success) return fail(await msg("invalid"))
  const ctx = await authed("detail", { max: 60, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const v = parsed.data
  const app = await managed(ctx, v.appId)
  if (!app) return fail(await msg("ownApp"))
  let error: { message: string } | null = null
  if (v.kind === "data_location") {
    ({ error } = await ctx.sb.from("app_data_locations").insert({ app_id: app.id, region: v.region, country_code: v.countryCode, description: v.description, is_default: v.isDefault, source_url: v.sourceUrl }))
  } else if (v.kind === "subprocessor") {
    ({ error } = await ctx.sb.from("app_subprocessors").insert({ app_id: app.id, name: cleanText(v.name, 120), purpose: v.purpose, country_code: v.countryCode, source_url: v.sourceUrl }))
  } else if (v.kind === "ai_provider") {
    ({ error } = await ctx.sb.from("app_ai_providers").insert({ app_id: app.id, provider: cleanText(v.provider, 80), model_name: v.modelName, purpose: v.purpose, source_url: v.sourceUrl }))
  } else {
    const name = cleanText(v.name, 80)
    const slug = slugify(name)
    // when the named product is listed here, the two profiles are linked
    const { data: target } = await ctx.sb.from("apps").select("id").eq("slug", slug).eq("status", "published").neq("id", app.id).maybeSingle()
    ;({ error } = await ctx.sb.from("app_alternatives").insert({ app_id: app.id, alternative_to_slug: slug, alternative_to_name: name, alternative_to_app_id: target?.id ?? null, source_url: v.sourceUrl }))
  }
  if (error) return fail(await msg("failed"))
  touch(app.slug)
  return { ok: true, message: await msg("saved") }
}

const removeSchema = z.object({ kind: z.enum(["data_location", "subprocessor", "ai_provider", "pricing_plan", "alternative"]), appId: uuid, id: z.string().min(2).max(80) })
const TABLES = { data_location: "app_data_locations", subprocessor: "app_subprocessors", ai_provider: "app_ai_providers", pricing_plan: "pricing_plans" } as const

/** Removes a row the maker entered. Rows that PWANova observed or reviewed cannot be removed (row level security). */
export async function removeDetail(input: z.input<typeof removeSchema>): Promise<ActionResult> {
  const parsed = removeSchema.safeParse(input)
  if (!parsed.success) return fail(await msg("invalid"))
  const ctx = await authed("detail-remove", { max: 60, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const v = parsed.data
  const app = await managed(ctx, v.appId)
  if (!app) return fail(await msg("ownApp"))
  const { error } = v.kind === "alternative"
    ? await ctx.sb.from("app_alternatives").delete().eq("app_id", app.id).eq("alternative_to_slug", v.id)
    : uuid.safeParse(v.id).success
      ? await ctx.sb.from(TABLES[v.kind]).delete().eq("app_id", app.id).eq("id", v.id)
      : { error: { message: "invalid id" } }
  if (error) return fail(await msg("failed"))
  touch(app.slug)
  return { ok: true, message: await msg("done") }
}

// ------------------------------------------------------------------ updates
const updateSchema = z.object({
  appId: uuid,
  kind: z.enum(["feature", "pricing", "integration", "launch", "major", "fix", "other"]),
  title: z.string().trim().min(3).max(140),
  body: optionalText(5000),
  version: optionalText(40),
  linkUrl: optionalLink,
  draft: z.boolean().default(false),
})

/** Publishing an update notifies the followers of the app, in the app only. Verified owners only (row level security). */
export async function publishUpdate(input: z.input<typeof updateSchema>): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) return fail(await msg("invalid"))
  const ctx = await authed("update", { max: 10, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const v = parsed.data
  const app = await managed(ctx, v.appId)
  if (!app) return fail(await msg("ownApp"))
  if (app.ownership_status !== "verified_owner") return fail(await msg("verifiedOwnerOnly"))
  const { error } = await ctx.sb.from("app_updates").insert({
    app_id: app.id, author_id: ctx.user.id, kind: v.kind, title: cleanText(v.title, 140), body: v.body, version: v.version, link_url: v.linkUrl,
    status: v.draft ? "draft" : "published",
  })
  if (error) return fail(await msg("failed"))
  touch(app.slug)
  revalidateLocalized("/notifications")
  return { ok: true, message: await msg("saved") }
}

// ------------------------------------------------------------------ launches
const launchSchema = z.object({
  appId: uuid,
  headline: z.string().trim().min(5).max(120),
  description: optionalText(2000),
  headlineDe: optionalText(120),
  descriptionDe: optionalText(2000),
  launchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function submitLaunch(input: z.input<typeof launchSchema>): Promise<ActionResult<{ slug: string }>> {
  const parsed = launchSchema.safeParse(input)
  if (!parsed.success) return fail(await msg("invalid"))
  const ctx = await authed("launch", { max: 6, windowSeconds: 86400 })
  if (!ctx.ok) return fail(ctx.error)
  if (!(await featureOn(ctx.sb, "launches"))) return fail(await msg("featureOff"))
  const v = parsed.data
  const app = await managed(ctx, v.appId)
  if (!app) return fail(await msg("ownApp"))
  if (app.ownership_status !== "verified_owner") return fail(await msg("verifiedOwnerOnly"))
  const date = new Date(`${v.launchDate}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.getTime() < Date.now() - 86_400_000 || date.getTime() > Date.now() + 180 * 86_400_000) return fail(await msg("invalid"))

  const slug = `${app.slug}-${v.launchDate}`.slice(0, 100)
  const { error } = await ctx.sb.from("launches").insert({
    app_id: app.id, slug, headline: cleanText(v.headline, 120), description: v.description, headline_de: v.headlineDe, description_de: v.descriptionDe,
    launch_date: v.launchDate, status: "pending", submitted_by: ctx.user.id,
  })
  if (error) return fail(await msg(/in progress|already/i.test(error.message) || error.code === "23505" ? "launchExists" : "failed"))
  revalidateLocalized(`/dashboard/apps/${app.slug}`, "/launches")
  return { ok: true, data: { slug }, message: await msg("saved") }
}

export async function cancelLaunch(launchId: string): Promise<ActionResult> {
  if (!uuid.safeParse(launchId).success) return fail(await msg("invalid"))
  const ctx = await authed("launch-cancel", { max: 12, windowSeconds: 86400 })
  if (!ctx.ok) return fail(ctx.error)
  const { data: launch } = await ctx.sb.from("launches").select("id, app_id, slug").eq("id", launchId).maybeSingle()
  if (!launch || !(await managed(ctx, launch.app_id))) return fail(await msg("ownApp"))
  const { error } = await ctx.sb.from("launches").update({ status: "cancelled" }).eq("id", launchId)
  if (error) return fail(await msg("failed"))
  revalidateLocalized("/launches", `/launches/${launch.slug}`, "/dashboard")
  return { ok: true, message: await msg("done") }
}

// ------------------------------------------------------------------ re-check
/**
 * The maker asks for a fresh look at their website. The database allows three requests a day per
 * listing; the run itself is recorded by the service role and cannot be influenced by the maker.
 */
export async function requestRecheck(appId: string): Promise<ActionResult<{ found: number; checked: number }>> {
  const ctx = await authed("recheck", { max: 6, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const app = await managed(ctx, appId)
  if (!app) return fail(await msg("ownApp"))
  const { error } = await ctx.sb.rpc("request_recheck", { p_app_id: app.id })
  if (error) return fail(await msg(error.message.includes("Rate limit") ? "recheckLimit" : "failed"))
  const run = await verifyApp(app.id, "maker_requested", ctx.user.id, 22_000)
  touch(app.slug)
  // without the service key (local demo) the request stays queued for the scheduled run
  if (!run.ok) return { ok: true, data: { found: 0, checked: 0 }, message: await msg("saved") }
  return { ok: true, data: { found: run.found ?? 0, checked: run.checked ?? 0 }, message: await msg("checksUpdated") }
}
