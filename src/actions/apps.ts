"use server"

import { z } from "zod"
import { authed, createCompany, fail } from "./common"
import { msg } from "./messages"
import { LOCALES } from "@/i18n/config"
import { analyzeUrl } from "@/lib/analyzer"
import { runAppChecks } from "@/lib/checks"
import { revalidateLocalized } from "@/lib/revalidate"
import { rateLimit } from "@/lib/security/rate-limit"
import { cleanHttpUrl, cleanText } from "@/lib/security/sanitize"
import { createAdminClient } from "@/lib/supabase/admin"
import { canonicalAppUrl, domainOf, parsePublicUrl, slugify, UrlError } from "@/lib/url"
import { verifyOwnership, type ClaimMethod } from "@/lib/verification"
import { isClaimExpired } from "@/lib/verification-utils"
import type { ActionResult } from "@/lib/types"

const PRICING_MODELS = ["unknown", "free", "freemium", "subscription", "one_time", "usage_based", "open_source", "contact_sales"] as const
const PLATFORMS = ["web", "ios", "android", "macos", "windows", "linux", "browser_extension"] as const // "pwa" is observed, never typed
/** Documents a submitter can point to. Each becomes a statement about one fact, with the URL as its source. */
const LINK_FACTS = {
  privacyUrl: "privacy_policy", legalUrl: "legal_notice", dpaUrl: "dpa_available", subprocessorsUrl: "subprocessors_published",
  pricingUrl: "pricing_page", githubUrl: "source_repository", apiDocsUrl: "api_docs", mcpDocsUrl: "mcp_available",
} as const
/** Capabilities a submitter can state. Anything not ticked stays unknown; it is never stored as "no". */
const CAPABILITIES = ["api_available", "mcp_available", "open_source", "self_hosted", "offline_capable", "sso", "ai_used", "eu_hosting_available", "no_training_on_customer_data"] as const

const optionalUrl = z.string().trim().max(500).optional()
const submitSchema = z.object({
  url: z.string().min(3).max(2048),
  name: z.string().trim().min(1).max(80),
  tagline: z.string().trim().min(3).max(120),
  description: z.string().max(4000).optional(),
  contentLocale: z.enum(LOCALES).default("en"),
  taglineDe: z.string().max(120).optional(),
  descriptionDe: z.string().max(4000).optional(),
  category: z.string().regex(/^[a-z0-9-]{2,60}$/),
  useCases: z.array(z.string().regex(/^[a-z0-9-]{2,60}$/)).max(5).default([]),
  companyName: z.string().trim().max(120).optional(),
  companyCountry: z.string().regex(/^[A-Z]{2}$/).optional().or(z.literal("")),
  pricingModel: z.enum(PRICING_MODELS).default("unknown"),
  hasFreePlan: z.boolean().nullable().default(null),
  hasFreeTrial: z.boolean().nullable().default(null),
  languages: z.array(z.string().regex(/^[a-z]{2}$/)).max(20).default([]),
  platforms: z.array(z.enum(PLATFORMS)).max(7).default([]),
  capabilities: z.array(z.enum(CAPABILITIES)).max(CAPABILITIES.length).default([]),
  privacyUrl: optionalUrl, legalUrl: optionalUrl, dpaUrl: optionalUrl, subprocessorsUrl: optionalUrl,
  pricingUrl: optionalUrl, githubUrl: optionalUrl, apiDocsUrl: optionalUrl, mcpDocsUrl: optionalUrl,
  iconUrl: optionalUrl,
  screenshots: z.array(z.string().max(500)).max(8).optional(),
  /** Partner code from the address the submitter arrived with (?ref=…). Attribution only; it changes nothing else. */
  ref: z.string().regex(/^[a-z0-9_-]{2,40}$/).optional(),
})
export type SubmitInput = z.input<typeof submitSchema>

/**
 * Creates a listing that waits for review. Everything the submitter enters is recorded as THEIR
 * statement: it is never shown as verified, and until they prove ownership it is not shown as a
 * vendor statement either. Trust signals always come from the server's own analysis.
 */
export async function submitApp(input: SubmitInput): Promise<ActionResult<{ slug: string; status: "pending" | "published" }> & { existingSlug?: string }> {
  const parsed = submitSchema.safeParse(input)
  if (!parsed.success) return fail(await msg("invalid"))
  const ctx = await authed("submit", { max: 5, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const v = parsed.data

  let url: URL
  try { url = parsePublicUrl(canonicalAppUrl(v.url)) } catch (e) { return fail(e instanceof UrlError ? e.message : await msg("urlInvalid")) }
  const domain = domainOf(url)

  const admin = createAdminClient()
  // Duplicates are looked up with the service role, so a listing that is still waiting for review counts too.
  const { data: dupe } = await (admin ?? ctx.sb).from("apps").select("slug, status").eq("url", url.href).maybeSingle()
  if (dupe) return { ok: false, error: await msg("duplicate"), ...(dupe.status === "published" && { existingSlug: dupe.slug }) }

  const { data: category } = await ctx.sb.from("categories").select("id, legacy_keys").eq("slug", v.category).eq("is_active", true).maybeSingle()
  if (!category) return fail(await msg("invalid"))

  // Never trust client-side analysis for trust signals: re-run on the server.
  const analysis = await analyzeUrl(url.href)

  let slug = slugify(v.name)
  const { data: taken } = await (admin ?? ctx.sb).from("apps").select("slug").like("slug", `${slug}%`)
  if (taken?.some((t) => t.slug === slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`

  let companyId: string | null = null
  const companyName = cleanText(v.companyName, 120)
  if (companyName) {
    const base = slugify(companyName)
    const { data: own } = await ctx.sb.from("companies").select("id").eq("created_by", ctx.user.id).eq("name", companyName).maybeSingle()
    if (own) companyId = own.id
    else companyId = await createCompany(ctx.sb, base, { name: companyName, country_code: v.companyCountry || null, website: url.origin, created_by: ctx.user.id })
  }

  const legacyCategory = (category.legacy_keys as string[] | null)?.[0] ?? "other"
  const { data: app, error } = await ctx.sb.from("apps").insert({
    developer_id: ctx.user.id, name: cleanText(v.name, 80), slug, tagline: cleanText(v.tagline, 120),
    description: cleanText(v.description, 4000), url: url.href, domain,
    icon_url: cleanHttpUrl(v.iconUrl) ?? analysis.iconUrl, category: legacyCategory, primary_category_id: category.id,
    build_tool: "other", hosting_provider: analysis.host, content_locale: v.contentLocale, company_id: companyId,
    pricing_model: v.pricingModel, has_free_plan: v.hasFreePlan, has_free_trial: v.hasFreeTrial, status: "pending",
  }).select("id, slug").single()
  if (error?.code === "23505") return fail(await msg("duplicate"))
  if (error || !app) return fail(await msg(error?.message.includes("Rate limit") ? "submitLimit" : "failed"))

  // Claim token right away: the owner can prove ownership while the listing waits for review.
  const { error: claimError } = await ctx.sb.rpc("begin_app_claim", { p_app_id: app.id })
  if (claimError) console.error("submitApp: could not create claim token", claimError.message)

  const shots = (v.screenshots?.length ? v.screenshots : analysis.screenshots).map((s) => cleanHttpUrl(s)).filter((s): s is string => Boolean(s))
  if (shots.length) await ctx.sb.from("app_screenshots").insert(shots.map((image_url, i) => ({ app_id: app.id, image_url, sort_order: i })))

  const taglineDe = cleanText(v.taglineDe, 120), descriptionDe = cleanText(v.descriptionDe, 4000)
  if (v.contentLocale !== "de" && (taglineDe || descriptionDe)) {
    await ctx.sb.from("app_translations").insert({ app_id: app.id, locale: "de", tagline: taglineDe || null, description: descriptionDe || null, updated_by: ctx.user.id })
  }
  if (v.languages.length) await ctx.sb.from("app_languages").insert([...new Set(v.languages)].map((language_code) => ({ app_id: app.id, language_code })))
  const platforms = [...new Set(v.platforms)].filter((p) => p !== "web") // "web" is added for every listing
  if (platforms.length) await ctx.sb.from("app_platforms").insert(platforms.map((platform) => ({ app_id: app.id, platform })))
  if (v.useCases.length) {
    const { data: useCases } = await ctx.sb.from("use_cases").select("id").in("slug", v.useCases)
    if (useCases?.length) await ctx.sb.from("app_use_cases").insert(useCases.map((u) => ({ app_id: app.id, use_case_id: u.id })))
  }

  // Statements. The database decides their origin (user submitted until ownership is proven) and status.
  // source_type and verification_method are required columns; the database overwrites what a client sends
  const stated = { source_type: "user_submitted", verification_method: "community" } as const
  const statements: { app_id: string; attribute_key: string; value_state: "yes"; value_text: string | null; source_url: string | null; source_title: string | null }[] = []
  for (const [field, attribute] of Object.entries(LINK_FACTS) as [keyof typeof LINK_FACTS, string][]) {
    const link = cleanHttpUrl(v[field])
    if (link) statements.push({ app_id: app.id, attribute_key: attribute, value_state: "yes", value_text: link, source_url: link, source_title: null })
  }
  for (const attribute of new Set(v.capabilities)) {
    if (statements.some((s) => s.attribute_key === attribute)) continue
    statements.push({ app_id: app.id, attribute_key: attribute, value_state: "yes", value_text: null, source_url: null, source_title: null })
  }
  if (v.hasFreePlan) statements.push({ app_id: app.id, attribute_key: "free_plan", value_state: "yes", value_text: null, source_url: cleanHttpUrl(v.pricingUrl), source_title: null })
  if (statements.length) {
    const { error: evidenceError } = await ctx.sb.from("app_evidence").insert(statements.map((s) => ({ ...s, ...stated })))
    if (evidenceError) console.error("submitApp: statements not saved", evidenceError.message)
  }

  // Partner attribution: the launch source stays "Direct"; a partner link is recorded as discovery.
  const partnerRef = v.ref ?? ""
  let partnerId: string | null = null
  if (admin && partnerRef) {
    const { data: partner } = await admin.from("partners").select("id").eq("status", "active").eq("is_demo", false).or(`slug.eq.${partnerRef},referral_code.eq.${partnerRef}`).limit(1).maybeSingle()
    partnerId = partner?.id ?? null
  }
  await (admin ?? ctx.sb).from("app_sources").insert({ app_id: app.id, partner_id: null, source_name: "Direct", source_url: null, source_type: "launched_on" })
  if (admin && partnerId) await admin.from("app_sources").insert({ app_id: app.id, partner_id: partnerId, source_name: "Partner referral", source_type: "discovered_via" })
  if (partnerId) await ctx.sb.from("partner_referrals").insert({ partner_id: partnerId, developer_id: ctx.user.id, app_id: app.id })

  await runAppChecks(app.id) // no-op without a service role key
  revalidateLocalized("/dashboard", "/discover")
  return { ok: true, data: { slug: app.slug, status: "pending" } }
}

/**
 * Begin (or restart) an ownership claim for a listed app. Every call issues a fresh, single-use token,
 * so a stale or failed attempt can never be replayed past its window.
 */
export async function startClaim(appId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(appId).success) return fail(await msg("invalid"))
  const ctx = await authed("claim", { max: 10, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const { data: app } = await ctx.sb.from("apps").select("id, slug, ownership_status").eq("id", appId).maybeSingle()
  if (!app) return fail(await msg("notFound"))
  if (app.ownership_status === "verified_owner") return fail(await msg("claimOwned"))

  const { error } = await ctx.sb.rpc("begin_app_claim", { p_app_id: appId })
  if (error) return fail(await msg("failed"))

  revalidateLocalized(`/apps/${app.slug}`, `/apps/${app.slug}/claim`)
  return { ok: true }
}

const methodSchema = z.enum(["well_known"])

/**
 * Checks the claim token on the live site, then assigns ownership atomically via `claim_app_ownership`
 * (one conditional UPDATE). Two concurrent verifications of the same app can never both win, and a
 * claim can never replace an existing verified owner.
 */
export async function verifyClaim(appId: string, method: ClaimMethod): Promise<ActionResult<{ verified: boolean }>> {
  if (!methodSchema.safeParse(method).success || !z.string().uuid().safeParse(appId).success) return fail(await msg("invalid"))
  const ctx = await authed("verify-claim", { max: 12, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const admin = createAdminClient()
  if (!admin) return fail(await msg("serverKey"))

  const [{ data: claim }, { data: app }] = await Promise.all([
    ctx.sb.from("app_claims").select("id, token, expires_at, status").eq("app_id", appId).eq("user_id", ctx.user.id).maybeSingle(),
    admin.from("apps").select("id, slug, url, domain, ownership_status, developer_id").eq("id", appId).maybeSingle(),
  ])
  if (!claim || !app) return fail(await msg("claimFirst"))
  if (app.ownership_status === "verified_owner") {
    return app.developer_id === ctx.user.id ? { ok: true, data: { verified: true }, message: await msg("claimVerified") } : fail(await msg("claimOwned"))
  }
  if (claim.status === "verified") return { ok: true, data: { verified: true }, message: await msg("claimVerified") }
  if (claim.status !== "pending") return fail(await msg("claimFirst"))
  if (isClaimExpired(claim.expires_at)) {
    await admin.from("app_claims").update({ status: "expired" }).eq("id", claim.id).eq("token", claim.token).eq("status", "pending")
    return fail(await msg("claimExpired"))
  }

  const result = await verifyOwnership(app.url, app.domain, claim.token, method)
  if (!result.ok) {
    await admin.from("app_claims").update({ last_error: result.error }).eq("id", claim.id).eq("token", claim.token).eq("status", "pending")
    return fail(await msg(new URL(app.url).protocol !== "https:" ? "claimHttps" : "claimNotFound"))
  }
  const { data: won, error: claimErr } = await admin.rpc("claim_app_ownership", { p_app_id: appId, p_user_id: ctx.user.id, p_claim_id: claim.id, p_token: claim.token, p_url: app.url })
  if (claimErr) return fail(await msg("failed"))
  if (!won) return fail(await msg("claimOwned"))

  await runAppChecks(appId)
  revalidateLocalized(`/apps/${app.slug}`, `/apps/${app.slug}/claim`, `/apps/${app.slug}/evidence`, "/dashboard")
  return { ok: true, data: { verified: true }, message: await msg("claimVerified") }
}

export interface AnalysisSummary {
  url: string; domain: string; reachable: boolean; title: string; description: string; iconUrl: string | null; screenshots: string[]
  host: string; isPwa: boolean; httpsOk: boolean | null; languages: string[]
  discovered: { kind: string; url: string }[]
  notes: string[]
}
export interface DuplicateHint { slug: string; name: string; domain: string; exact: boolean }

/**
 * What PWANova can read from a URL before anything is submitted, and whether the app is already listed.
 * Only public listings are named; a listing that is waiting for review is reported without details.
 */
export async function analyzeApp(url: string): Promise<{ ok: true; analysis: AnalysisSummary; duplicates: DuplicateHint[]; alreadySubmitted: boolean } | { ok: false; error: string }> {
  const ctx = await authed("analyze", { max: 20, windowSeconds: 3600 })
  if (!ctx.ok) return { ok: false, error: ctx.error }
  let canonical: string
  try { canonical = canonicalAppUrl(url) } catch (e) { return { ok: false, error: e instanceof UrlError ? e.message : await msg("urlInvalid") } }
  if (!(await rateLimit(`analyze-day:${ctx.user.id}`, 40, 86400))) return { ok: false, error: await msg("analysisLimit") }

  const a = await analyzeUrl(canonical)
  const domain = a.domain
  const admin = createAdminClient()
  const finalCanonical = (() => { try { return canonicalAppUrl(a.finalUrl) } catch { return canonical } })()
  // two plain filters instead of one or(): a URL may contain characters that have a meaning in a filter expression
  const db = admin ?? ctx.sb
  const [byUrl, byDomain] = await Promise.all([
    db.from("apps").select("slug, name, domain, url, status").in("url", [...new Set([canonical, finalCanonical])]).limit(5),
    db.from("apps").select("slug, name, domain, url, status").eq("domain", domain).limit(10),
  ])
  const rows = [...new Map([...(byUrl.data ?? []), ...(byDomain.data ?? [])].map((r) => [r.slug, r])).values()]
  const exact = rows.filter((r) => r.url === canonical || r.url === finalCanonical)
  const duplicates: DuplicateHint[] = rows.filter((r) => r.status === "published").map((r) => ({ slug: r.slug, name: r.name, domain: r.domain, exact: exact.some((e) => e.slug === r.slug) }))

  // listings with a very similar name, from the public search index
  const name = a.title.split(/[|–—·:-]/)[0]?.trim()
  if (name && name.length >= 3) {
    const { data: ranked } = await ctx.sb.rpc("search_catalog", { p_query: name, p_filters: {}, p_sort: "relevance", p_limit: 3, p_offset: 0 })
    const ids = (ranked ?? []).filter((r) => r.score >= 0.5).map((r) => r.app_id)
    if (ids.length) {
      const { data: similar } = await ctx.sb.from("catalog_apps").select("slug, name, domain").in("id", ids)
      for (const s of similar ?? []) if (!duplicates.some((d) => d.slug === s.slug)) duplicates.push({ slug: s.slug as string, name: s.name as string, domain: s.domain as string, exact: false })
    }
  }

  return {
    ok: true,
    analysis: {
      url: canonical, domain, reachable: a.reachable, title: a.title, description: a.description, iconUrl: a.iconUrl, screenshots: a.screenshots,
      host: a.host, isPwa: a.isPwa, httpsOk: a.checks.https_ok, languages: a.languages, discovered: a.discovered.map(({ kind, url: u }) => ({ kind, url: u })), notes: a.notes,
    },
    duplicates,
    alreadySubmitted: exact.some((e) => e.status !== "published"),
  }
}
