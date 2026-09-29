/* eslint-disable @typescript-eslint/no-explicit-any -- PostgREST rows are mapped to typed objects at this boundary */
import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { demoMode, isSupabaseConfigured, showDemoData } from "@/lib/env"
import { demo } from "./demo"
import { asJson, nullable } from "@/lib/supabase/rpc"
import type { AppView } from "@/lib/types"
import type {
  AppDetail, AppFact, CatalogApp, CatalogFilters, CatalogSort, CategoryInfo, EvidenceItem, FacetCounts, FactAttribute,
  FactSummary, LaunchItem, Platform,
} from "@/lib/v2/types"

type Row = any

// ------------------------------------------------------------------ mappers
const factSummary = (f: Row): FactSummary => ({
  state: f?.state ?? "unknown", origin: f?.source ?? "none", value: f?.value ?? null,
  checkedAt: f?.checked_at ?? null, statedAt: f?.stated_at ?? null,
})

export function mapCatalogApp(r: Row): CatalogApp {
  return {
    id: r.id, slug: r.slug, name: r.name, tagline: r.tagline ?? "", description: r.description ?? "",
    contentLocale: r.content_locale ?? "en", taglineDe: r.tagline_de ?? null, descriptionDe: r.description_de ?? null,
    url: r.url, domain: r.domain, iconUrl: r.icon_url, status: r.status, isDemo: Boolean(r.is_demo), isFeatured: Boolean(r.is_featured),
    isPwa: Boolean(r.is_pwa), hostingProvider: r.hosting_provider ?? "other", createdAt: r.created_at, updatedAt: r.updated_at,
    developer: { id: r.developer_id, username: r.developer_username, name: r.developer_name, avatarUrl: r.developer_avatar },
    ownershipStatus: r.ownership_status, ownershipVerifiedAt: r.ownership_verified_at ?? null,
    category: r.category_id ? { id: r.category_id, slug: r.category_slug, name: r.category_name ?? {} } : null,
    categorySlugs: r.category_slugs ?? [], useCases: r.use_cases ?? [],
    company: r.company_id
      ? { id: r.company_id, slug: r.company_slug, name: r.company_name, countryCode: r.company_country, inEu: r.company_in_eu, sourceType: r.company_source_type }
      : null,
    pricingModel: r.pricing_model ?? "unknown", hasFreePlan: r.has_free_plan, hasFreeTrial: r.has_free_trial,
    startingPriceCents: r.starting_price_cents, priceCurrency: r.price_currency,
    languages: r.languages ?? [], platforms: (r.platforms ?? []) as Platform[], integrations: r.integrations ?? [],
    verificationState: r.verification_state ?? "unverified", evidenceScore: r.evidence_score ?? 0,
    evidenceCheckedAt: r.evidence_checked_at ?? null, profileCompleteness: r.profile_completeness ?? 0,
    facts: Object.fromEntries(Object.entries((r.facts ?? {}) as Record<string, Row>).map(([k, v]) => [k, factSummary(v)])),
    rating: Number(r.rating ?? 0), ratingsCount: r.ratings_count ?? 0, reviewsCount: r.reviews_count ?? 0,
    favoritesCount: r.favorites_count ?? 0, followersCount: r.followers_count ?? 0, updatesCount: r.updates_count ?? 0,
    opens30d: r.opens_30d ?? 0, organicScore: Number(r.organic_score ?? 0),
  }
}

/** Without a database (local demo mode) the sample apps are shown with every trust fact unknown. */
function demoCatalogApp(a: AppView): CatalogApp {
  return {
    id: a.id, slug: a.slug, name: a.name, tagline: a.tagline, description: a.description, contentLocale: "en", taglineDe: null, descriptionDe: null,
    url: a.url, domain: a.domain, iconUrl: a.iconUrl, status: a.status, isDemo: true, isFeatured: a.isFeatured, isPwa: a.isPwa,
    hostingProvider: a.hostingProvider, createdAt: a.createdAt, updatedAt: a.updatedAt,
    developer: { id: a.developer.id, username: a.developer.username, name: a.developer.name, avatarUrl: a.developer.avatarUrl },
    ownershipStatus: a.ownershipStatus, ownershipVerifiedAt: null, category: null, categorySlugs: [], useCases: [], company: null,
    pricingModel: "unknown", hasFreePlan: null, hasFreeTrial: null, startingPriceCents: null, priceCurrency: null,
    languages: [], platforms: a.isPwa ? ["pwa", "web"] : ["web"], integrations: [],
    verificationState: "unverified", evidenceScore: 0, evidenceCheckedAt: null, profileCompleteness: 0, facts: {},
    rating: a.rating, ratingsCount: a.ratingsCount, reviewsCount: a.reviewsCount, favoritesCount: a.favoritesCount,
    followersCount: 0, updatesCount: 0, opens30d: a.opens30d, organicScore: 0,
  }
}
const demoCatalog = () => (demoMode ? demo().apps.map(demoCatalogApp) : [])

function filtersToJson(f: CatalogFilters): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const list = (key: string, v?: string[]) => { if (v?.length) out[key] = v.slice(0, 20) }
  list("categories", f.categories); list("use_cases", f.useCases); list("integrations", f.integrations)
  list("languages", f.languages); list("platforms", f.platforms); list("pricing_models", f.pricingModels)
  list("countries", f.countries); list("hosts", f.hosts); list("facts", f.facts); list("verification", f.verification)
  if (f.verifiedOnly) out.verified_only = true
  if (f.euCompany) out.eu_company = true
  if (f.freePlan) out.free_plan = true
  if (f.freeTrial) out.free_trial = true
  if (f.ownerVerified) out.owner_verified = true
  if (f.checkedWithinDays) out.checked_within_days = f.checkedWithinDays
  if (f.minRating) out.min_rating = f.minRating
  if (f.developerId) out.developer_id = f.developerId
  if (showDemoData) out.demo = true
  return out
}

// ------------------------------------------------------------------ registry and taxonomy
export const getFactRegistry = cache(async (): Promise<FactAttribute[]> => {
  if (!isSupabaseConfigured) return []
  const sb = await createClient()
  const { data } = await sb.from("fact_attributes").select("*").order("sort_order")
  return (data ?? []).map((r: Row): FactAttribute => ({
    key: r.key, dimension: r.dimension, valueType: r.value_type, label: r.label ?? {}, positiveLabel: r.positive_label ?? {},
    negativeLabel: r.negative_label ?? {}, description: r.description ?? {}, isExpected: r.is_expected, isFilterable: r.is_filterable,
    isCardSignal: r.is_card_signal, autoCheckable: r.auto_checkable, ttlDays: r.ttl_days, sortOrder: r.sort_order,
  }))
})

export const getCategories = cache(async (): Promise<CategoryInfo[]> => {
  if (!isSupabaseConfigured) return []
  const sb = await createClient()
  const [{ data: cats }, facets] = await Promise.all([
    sb.from("categories").select("id, slug, name, description, icon, sort_order").eq("is_active", true).order("sort_order"),
    getFacetCounts(),
  ])
  return (cats ?? []).map((c: Row): CategoryInfo => ({
    id: c.id, slug: c.slug, name: c.name ?? {}, description: c.description ?? {}, icon: c.icon, sortOrder: c.sort_order,
    count: facets.categories[c.slug] ?? 0,
  }))
})

export const getUseCases = cache(async (): Promise<{ slug: string; name: Record<string, string>; categorySlug: string | null }[]> => {
  if (!isSupabaseConfigured) return []
  const sb = await createClient()
  const { data } = await sb.from("use_cases").select("slug, name, category:categories(slug)").eq("is_active", true).order("slug")
  return (data ?? []).map((u: Row) => ({ slug: u.slug, name: u.name ?? {}, categorySlug: u.category?.slug ?? null }))
})

export const getIntegrationCatalog = cache(async (): Promise<{ slug: string; name: string }[]> => {
  if (!isSupabaseConfigured) return []
  const sb = await createClient()
  const { data } = await sb.from("integration_catalog").select("slug, name").eq("is_active", true).order("name")
  return (data ?? []) as { slug: string; name: string }[]
})

/**
 * How many public listings each filter value would match. A filter is only offered when its count
 * is above zero, so the interface never suggests data that does not exist.
 */
export const getFacetCounts = cache(async (): Promise<FacetCounts> => {
  const empty: FacetCounts = { categories: {}, facts: {}, factsVerified: {}, languages: {}, platforms: {}, pricingModels: {}, countries: {}, integrations: {}, useCases: {}, euCompany: 0, freePlan: 0, freeTrial: 0, ownerVerified: 0, checkedRecently: 0, withVerifiedFacts: 0, total: 0 }
  if (!isSupabaseConfigured) return empty
  const sb = await createClient()
  let q = sb.from("catalog_apps").select("category_slugs, facts_yes, facts_verified_yes, languages, platforms, pricing_model, company_country, company_in_eu, has_free_plan, has_free_trial, ownership_status, evidence_checked_at, integrations, use_cases")
  if (!showDemoData) q = q.eq("is_demo", false)
  const { data, error } = await q.limit(5000)
  if (error) { console.error("getFacetCounts", error.message); return empty }
  const out = empty
  const recent = Date.now() - 30 * 86_400_000
  const bump = (bag: Record<string, number>, keys: string[] | null | undefined) => { for (const k of keys ?? []) bag[k] = (bag[k] ?? 0) + 1 }
  for (const r of (data ?? []) as Row[]) {
    out.total++
    bump(out.categories, r.category_slugs); bump(out.facts, r.facts_yes); bump(out.factsVerified, r.facts_verified_yes)
    bump(out.languages, r.languages); bump(out.platforms, r.platforms); bump(out.integrations, r.integrations); bump(out.useCases, r.use_cases)
    if (r.pricing_model && r.pricing_model !== "unknown") bump(out.pricingModels, [r.pricing_model])
    if (r.company_country) bump(out.countries, [r.company_country])
    if (r.company_in_eu) out.euCompany++
    if (r.has_free_plan) out.freePlan++
    if (r.has_free_trial) out.freeTrial++
    if (r.ownership_status === "verified_owner") out.ownerVerified++
    if (r.evidence_checked_at && new Date(r.evidence_checked_at).getTime() >= recent) out.checkedRecently++
    if (r.facts_verified_yes?.length) out.withVerifiedFacts++
  }
  return out
})

// ------------------------------------------------------------------ catalogue
export interface CatalogPage { apps: CatalogApp[]; total: number; page: number; pageSize: number }

export async function searchCatalog(opts: { q?: string; filters?: CatalogFilters; sort?: CatalogSort; page?: number; pageSize?: number } = {}): Promise<CatalogPage> {
  const pageSize = Math.min(48, Math.max(1, opts.pageSize ?? 24))
  const page = Math.max(1, opts.page ?? 1)
  if (!isSupabaseConfigured) {
    const all = demoCatalog().filter((a) => !opts.q || `${a.name} ${a.tagline}`.toLowerCase().includes(opts.q.toLowerCase()))
    return { apps: all.slice((page - 1) * pageSize, page * pageSize), total: all.length, page, pageSize }
  }
  const sb = await createClient()
  const { data: ranked, error } = await sb.rpc("search_catalog", {
    p_query: nullable(opts.q?.trim() || null), p_filters: asJson(filtersToJson(opts.filters ?? {})), p_sort: opts.sort ?? "relevance",
    p_limit: pageSize, p_offset: (page - 1) * pageSize,
  })
  if (error) { console.error("searchCatalog", error.message); return { apps: [], total: 0, page, pageSize } }
  const ids = ((ranked ?? []) as Row[]).map((r) => r.app_id as string)
  if (!ids.length) return { apps: [], total: 0, page, pageSize }
  const { data: rows } = await sb.from("catalog_apps").select("*").in("id", ids)
  const byId = new Map(((rows ?? []) as Row[]).map((r) => [r.id as string, mapCatalogApp(r)]))
  return { apps: ids.map((id) => byId.get(id)).filter((a): a is CatalogApp => Boolean(a)), total: Number((ranked as Row[])[0]?.total ?? ids.length), page, pageSize }
}

async function catalogQuery(build: (q: any) => any, limit: number): Promise<CatalogApp[]> {
  if (!isSupabaseConfigured) return []
  const sb = await createClient()
  let q = sb.from("catalog_apps").select("*")
  if (!showDemoData) q = q.eq("is_demo", false)
  const { data, error } = await build(q).limit(limit)
  if (error) { console.error("catalogQuery", error.message); return [] }
  return ((data ?? []) as Row[]).map(mapCatalogApp)
}

/** Which of these slugs are public listings. A light question, asked before the listings themselves are loaded. */
export const getPublicSlugs = async (candidates: string[]): Promise<Set<string>> => {
  const list = candidates.slice(0, 40)
  if (!list.length) return new Set()
  if (!isSupabaseConfigured) return new Set(demoCatalog().map((a) => a.slug).filter((s) => list.includes(s)))
  const sb = await createClient()
  const { data } = await sb.from("catalog_apps").select("slug, is_demo").in("slug", list)
  return new Set((data ?? []).filter((r) => showDemoData || !r.is_demo).flatMap((r) => (r.slug ? [r.slug] : [])))
}

export const getCatalogBySlugs = async (slugs: string[]): Promise<CatalogApp[]> => {
  if (!slugs.length) return []
  if (!isSupabaseConfigured) return demoCatalog().filter((a) => slugs.includes(a.slug))
  const sb = await createClient()
  const { data } = await sb.from("catalog_apps").select("*").in("slug", slugs.slice(0, 8))
  const rows = ((data ?? []) as Row[]).filter((r) => showDemoData || !r.is_demo).map(mapCatalogApp)
  return slugs.map((s) => rows.find((r) => r.slug === s)).filter((a): a is CatalogApp => Boolean(a))
}

export const getEditorsPicks = (limit = 6) =>
  isSupabaseConfigured
    ? catalogQuery((q) => q.eq("is_featured", true).order("featured_at", { ascending: true, nullsFirst: false }), limit)
    : Promise.resolve(demoCatalog().filter((a) => a.isFeatured).slice(0, limit))

/** Listings whose evidence PWANova checked in the last 30 days, newest check first. */
export const getRecentlyVerified = (limit = 6) =>
  catalogQuery((q) => q.gte("evidence_checked_at", new Date(Date.now() - 30 * 86_400_000).toISOString()).order("evidence_checked_at", { ascending: false }), limit)

export const getNewestApps = (limit = 6) => catalogQuery((q) => q.order("created_at", { ascending: false }), limit)

export interface AlternativeEntry { app: CatalogApp; alternativeTo: { slug: string; name: string }[] }

/** EU-based products that state what they are an alternative to. Only listings whose company country is documented. */
export async function getEuropeanAlternatives(limit = 6): Promise<AlternativeEntry[]> {
  if (!isSupabaseConfigured) return []
  const sb = await createClient()
  const { data: alts } = await sb.from("app_alternatives").select("app_id, alternative_to_slug, alternative_to_name").neq("source_type", "user_submitted").limit(500)
  const byApp = new Map<string, { slug: string; name: string }[]>()
  for (const a of (alts ?? []) as Row[]) byApp.set(a.app_id, [...(byApp.get(a.app_id) ?? []), { slug: a.alternative_to_slug, name: a.alternative_to_name }])
  if (!byApp.size) return []
  const apps = await catalogQuery((q) => q.in("id", [...byApp.keys()]).eq("company_in_eu", true).order("organic_score", { ascending: false }), limit)
  return apps.map((app) => ({ app, alternativeTo: byApp.get(app.id) ?? [] }))
}

/** Apps that are listed as an alternative to the given product slug. */
export async function getAlternativesTo(slug: string): Promise<{ name: string; apps: CatalogApp[] }> {
  if (!isSupabaseConfigured) return { name: slug, apps: [] }
  const sb = await createClient()
  const { data: alts } = await sb.from("app_alternatives").select("app_id, alternative_to_name").eq("alternative_to_slug", slug).neq("source_type", "user_submitted").limit(200)
  const rows = (alts ?? []) as Row[]
  if (!rows.length) return { name: slug, apps: [] }
  const apps = await catalogQuery((q) => q.in("id", rows.map((r) => r.app_id)).order("organic_score", { ascending: false }), 60)
  return { name: rows[0].alternative_to_name, apps }
}

// ------------------------------------------------------------------ app detail
const sourced = (r: Row) => ({ sourceType: r.source_type, sourceUrl: r.source_url ?? null, verifiedAt: r.verified_at ?? null })

export const getAppDetail = cache(async (slug: string): Promise<AppDetail | null> => {
  if (!isSupabaseConfigured) {
    const app = demoCatalog().find((a) => a.slug === slug)
    return app ? { app, facts: [], pricingPlans: [], languages: [], platforms: [], integrations: [], useCases: [], categories: [], dataLocations: [], subprocessors: [], aiProviders: [], updates: [], alternativeTo: [], screenshots: [] } : null
  }
  const sb = await createClient()
  const { data: row } = await sb.from("catalog_apps").select("*").eq("slug", slug).maybeSingle()
  if (!row || ((row as Row).is_demo && !showDemoData)) return null
  const app = mapCatalogApp(row)
  const id = app.id
  const [facts, plans, langs, plats, ints, ucs, cats, locs, subs, ai, updates, alts, shots] = await Promise.all([
    sb.from("app_facts").select("*").eq("app_id", id),
    sb.from("pricing_plans").select("*").eq("app_id", id).neq("source_type", "user_submitted").order("sort_order"),
    sb.from("app_languages").select("*").eq("app_id", id).neq("source_type", "user_submitted").order("language_code"),
    sb.from("app_platforms").select("*").eq("app_id", id).neq("source_type", "user_submitted").order("platform"),
    sb.from("app_integrations").select("source_type, source_url, verified_at, integration:integration_catalog(slug, name)").eq("app_id", id).neq("source_type", "user_submitted"),
    sb.from("app_use_cases").select("use_case:use_cases(slug, name)").eq("app_id", id),
    sb.from("app_categories").select("is_primary, category:categories(slug, name)").eq("app_id", id),
    sb.from("app_data_locations").select("*").eq("app_id", id).neq("source_type", "user_submitted"),
    sb.from("app_subprocessors").select("*").eq("app_id", id).neq("source_type", "user_submitted").order("name"),
    sb.from("app_ai_providers").select("*").eq("app_id", id).neq("source_type", "user_submitted").order("provider"),
    sb.from("app_updates").select("*").eq("app_id", id).eq("status", "published").order("published_at", { ascending: false }).limit(20),
    sb.from("app_alternatives").select("alternative_to_slug, alternative_to_name, source_type, target:apps!app_alternatives_alternative_to_app_id_fkey(slug, status)").eq("app_id", id).neq("source_type", "user_submitted"),
    sb.from("app_screenshots").select("image_url").eq("app_id", id).order("sort_order"),
  ])
  return {
    app,
    facts: ((facts.data ?? []) as Row[]).map(mapFact),
    pricingPlans: ((plans.data ?? []) as Row[]).map((p) => ({
      id: p.id, name: p.name, billingInterval: p.billing_interval, priceCents: p.price_cents, currency: p.currency, perUser: p.per_user,
      description: p.description, updatedAt: p.updated_at, ...sourced(p),
    })),
    languages: ((langs.data ?? []) as Row[]).map((l) => ({ code: l.language_code, ...sourced(l) })),
    platforms: ((plats.data ?? []) as Row[]).map((p) => ({ platform: p.platform, ...sourced(p) })),
    integrations: ((ints.data ?? []) as Row[]).filter((i) => i.integration).map((i) => ({ slug: i.integration.slug, name: i.integration.name, ...sourced(i) })),
    useCases: ((ucs.data ?? []) as Row[]).filter((u) => u.use_case).map((u) => ({ slug: u.use_case.slug, name: u.use_case.name ?? {} })),
    categories: ((cats.data ?? []) as Row[]).filter((c) => c.category).map((c) => ({ slug: c.category.slug, name: c.category.name ?? {}, isPrimary: c.is_primary })),
    dataLocations: ((locs.data ?? []) as Row[]).map((d) => ({ id: d.id, region: d.region, countryCode: d.country_code, description: d.description, isDefault: d.is_default, ...sourced(d) })),
    subprocessors: ((subs.data ?? []) as Row[]).map((d) => ({ id: d.id, name: d.name, purpose: d.purpose, countryCode: d.country_code, ...sourced(d) })),
    aiProviders: ((ai.data ?? []) as Row[]).map((d) => ({ id: d.id, provider: d.provider, modelName: d.model_name, purpose: d.purpose, ...sourced(d) })),
    updates: ((updates.data ?? []) as Row[]).map((u) => ({ id: u.id, kind: u.kind, title: u.title, body: u.body, version: u.version, linkUrl: u.link_url, publishedAt: u.published_at, status: u.status })),
    alternativeTo: ((alts.data ?? []) as Row[]).map((a) => ({ slug: a.alternative_to_slug, name: a.alternative_to_name, appSlug: a.target?.status === "published" ? a.target.slug : null, sourceType: a.source_type })),
    screenshots: ((shots.data ?? []) as Row[]).map((s) => s.image_url),
  }
})

export function mapFact(f: Row): AppFact {
  return {
    key: f.attribute_key, verifiedState: f.verified_state, verifiedValue: f.verified_value, verifiedSourceType: f.verified_source_type,
    verifiedSourceUrl: f.verified_source_url, verifiedAt: f.verified_at, vendorState: f.vendor_state, vendorValue: f.vendor_value,
    vendorSourceUrl: f.vendor_source_url, vendorStatedAt: f.vendor_stated_at, effectiveState: f.effective_state, origin: f.effective_source,
    lastAttemptAt: f.last_attempt_at, lastAttemptOutcome: f.last_attempt_outcome,
  }
}

export function mapEvidence(e: Row): EvidenceItem {
  return {
    id: e.id, key: e.attribute_key, state: e.value_state, value: e.value_text, sourceType: e.source_type, method: e.verification_method,
    sourceUrl: e.source_url, sourceTitle: e.source_title, excerpt: e.evidence_excerpt, status: e.status, collectedAt: e.collected_at,
    verifiedAt: e.verified_at, lastConfirmedAt: e.last_confirmed_at, confirmations: e.confirmations ?? 1, reviewNote: e.review_note ?? null,
  }
}

/** Public evidence history of one app: current and superseded rows, newest first. */
export async function getEvidenceHistory(appId: string, limit = 200): Promise<EvidenceItem[]> {
  if (!isSupabaseConfigured) return []
  const sb = await createClient()
  const { data } = await sb.from("app_evidence").select("*").eq("app_id", appId).in("status", ["current", "superseded"])
    .order("collected_at", { ascending: false }).limit(limit)
  return ((data ?? []) as Row[]).map(mapEvidence)
}

export interface VerificationRun { id: string; runType: string; status: string; startedAt: string; completedAt: string | null; checkedUrl: string | null; found: number; notFound: number; failed: number }
export async function getVerificationRuns(appId: string, limit = 10): Promise<VerificationRun[]> {
  if (!isSupabaseConfigured) return []
  const sb = await createClient()
  const { data } = await sb.from("verification_runs").select("id, run_type, status, started_at, completed_at, checked_url, result_summary").eq("app_id", appId)
    .order("started_at", { ascending: false }).limit(limit)
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id, runType: r.run_type, status: r.status, startedAt: r.started_at, completedAt: r.completed_at, checkedUrl: r.checked_url,
    found: Number(r.result_summary?.found ?? 0), notFound: Number(r.result_summary?.not_found ?? 0), failed: Number(r.result_summary?.could_not_check ?? 0),
  }))
}

/** Other listings of the same category, best organic score first. */
export async function getSimilarApps(app: CatalogApp, limit = 4): Promise<CatalogApp[]> {
  if (!app.category) return []
  const rows = await catalogQuery((q) => q.eq("category_id", app.category!.id).neq("id", app.id).order("organic_score", { ascending: false }), limit)
  return rows
}

/** The launch of an app that is in its discovery window, if there is one. */
export async function getActiveLaunchSlug(appId: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  const sb = await createClient()
  const { data } = await sb.from("launch_board").select("slug").eq("app_id", appId).eq("in_window", true).limit(1).maybeSingle()
  return (data as Row)?.slug ?? null
}

/** The slug of the listing a merged duplicate points at, for a redirect from the old URL. */
export async function getDuplicateTarget(slug: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  const sb = await createClient()
  const { data } = await sb.rpc("duplicate_target", { p_slug: slug })
  return (data as string | null) ?? null
}

// ------------------------------------------------------------------ launches
function mapLaunch(r: Row): LaunchItem {
  return {
    id: r.id, slug: r.slug, headline: r.headline, description: r.description, headlineDe: r.headline_de, descriptionDe: r.description_de,
    launchDate: r.launch_date, windowStart: r.window_start, windowEnd: r.window_end, inWindow: Boolean(r.in_window), isSponsored: Boolean(r.is_sponsored),
    app: { id: r.app_id, slug: r.app_slug, name: r.app_name, tagline: r.app_tagline ?? "", iconUrl: r.app_icon_url, verificationState: r.verification_state, evidenceScore: r.evidence_score ?? 0, isDemo: Boolean(r.is_demo) },
    maker: { username: r.maker_username, name: r.maker_name },
    signals: { saves: Number(r.saves ?? 0), follows: Number(r.follows ?? 0), reviews: Number(r.reviews ?? 0), visitors: Number(r.visitors ?? 0) },
    score: Number(r.launch_score ?? 0),
  }
}

export async function getLaunches(opts: { current: boolean; limit?: number }): Promise<LaunchItem[]> {
  if (!isSupabaseConfigured) return []
  const sb = await createClient()
  let q = sb.from("launch_board").select("*").eq("in_window", opts.current)
  if (!showDemoData) q = q.eq("is_demo", false)
  q = opts.current ? q.order("launch_score", { ascending: false }) : q.order("window_start", { ascending: false })
  const { data, error } = await q.limit(opts.limit ?? 30)
  if (error) { console.error("getLaunches", error.message); return [] }
  return ((data ?? []) as Row[]).map(mapLaunch)
}

export async function getLaunch(slug: string): Promise<LaunchItem | null> {
  if (!isSupabaseConfigured) return null
  const sb = await createClient()
  const { data } = await sb.from("launch_board").select("*").eq("slug", slug).maybeSingle()
  if (!data || ((data as Row).is_demo && !showDemoData)) return null
  return mapLaunch(data)
}

// ------------------------------------------------------------------ settings
export interface SiteFeatures { launches: boolean; requests: boolean; compare: boolean; newsletter: boolean; sponsorship: boolean }
export interface OperatorInfo { legal_name: string | null; street: string | null; postal_code: string | null; city: string | null; country: string | null; email: string | null; phone: string | null; represented_by: string | null; register: string | null; vat_id: string | null; responsible_for_content: string | null }

export const getPublicSettings = cache(async (): Promise<{ features: SiteFeatures; monetizationEnforced: boolean; operator: OperatorInfo }> => {
  const fallback = {
    features: { launches: true, requests: true, compare: true, newsletter: true, sponsorship: false },
    monetizationEnforced: false,
    operator: { legal_name: null, street: null, postal_code: null, city: null, country: null, email: null, phone: null, represented_by: null, register: null, vat_id: null, responsible_for_content: null },
  }
  if (!isSupabaseConfigured) return fallback
  const sb = await createClient()
  const { data } = await sb.from("site_settings").select("key, value").in("key", ["features", "monetization", "operator"])
  const by = new Map(((data ?? []) as Row[]).map((r) => [r.key as string, r.value]))
  return {
    features: { ...fallback.features, ...(by.get("features") ?? {}) },
    monetizationEnforced: Boolean(by.get("monetization")?.enforced),
    operator: { ...fallback.operator, ...(by.get("operator") ?? {}) },
  }
})

export interface PlanInfo { slug: string; audience: "maker" | "vendor" | "sponsor"; name: Record<string, string>; summary: Record<string, string>; features: Record<string, string>[]; priceCents: number; currency: string; billingInterval: "free" | "one_time" | "month" | "issue"; isAvailable: boolean }
export const getPlans = cache(async (): Promise<PlanInfo[]> => {
  if (!isSupabaseConfigured) return []
  const sb = await createClient()
  const { data } = await sb.from("plans").select("*").eq("is_public", true).order("sort_order")
  return ((data ?? []) as Row[]).map((p) => ({ slug: p.slug, audience: p.audience, name: p.name ?? {}, summary: p.summary ?? {}, features: p.features ?? [], priceCents: p.price_cents, currency: p.currency, billingInterval: p.billing_interval, isAvailable: p.is_available }))
})

export interface SponsorSlot { id: string; sponsorName: string; headline: Record<string, string>; targetUrl: string | null; app: CatalogApp | null }
/** Active, labelled sponsor placements for one surface. They are rendered apart from organic results. */
export async function getSponsorSlots(placement: "home" | "category" | "discover" | "launches", categoryId?: string): Promise<SponsorSlot[]> {
  if (!isSupabaseConfigured) return []
  const { features } = await getPublicSettings()
  if (!features.sponsorship) return []
  const sb = await createClient()
  let q = sb.from("sponsor_campaigns").select("id, sponsor_name, headline, target_url, app_id, category_id").eq("placement", placement).eq("status", "active")
  if (categoryId) q = q.eq("category_id", categoryId)
  const { data } = await q.limit(2)
  const rows = (data ?? []) as Row[]
  const apps = await catalogQuery((c) => c.in("id", rows.map((r) => r.app_id).filter(Boolean)), 2)
  return rows.map((r) => ({ id: r.id, sponsorName: r.sponsor_name, headline: r.headline ?? {}, targetUrl: r.target_url, app: apps.find((a) => a.id === r.app_id) ?? null }))
}

/**
 * "Popular with German-language visitors": aggregate first-party events from one language edition.
 * Returns nothing until enough listings have real engagement, so the block never shows thin data.
 */
export async function getPopular(locale: string, limit = 6): Promise<CatalogApp[]> {
  if (!isSupabaseConfigured) return []
  const sb = await createClient()
  const { data, error } = await sb.rpc("popular_apps", { p_locale: locale, p_days: 30, p_limit: limit })
  if (error || !data?.length) return []
  const ids = (data as Row[]).map((r) => r.app_id as string)
  const apps = await catalogQuery((q) => q.in("id", ids), limit)
  return ids.map((id) => apps.find((a) => a.id === id)).filter((a): a is CatalogApp => Boolean(a))
}

// ------------------------------------------------------------------ candidates for request matching
/** Public, non-demo listings of the given categories (or all when none is given), for deterministic matching. */
export async function getMatchCandidates(sb: Pick<Awaited<ReturnType<typeof createClient>>, "from">, categorySlugs: string[], useCaseSlugs: string[], limit = 400): Promise<CatalogApp[]> {
  let q = sb.from("catalog_apps").select("*")
  if (!showDemoData) q = q.eq("is_demo", false)
  if (categorySlugs.length && !useCaseSlugs.length) q = q.overlaps("category_slugs", categorySlugs)
  const { data, error } = await q.order("organic_score", { ascending: false }).limit(limit)
  if (error) { console.error("getMatchCandidates", error.message); return [] }
  return ((data ?? []) as Row[]).map(mapCatalogApp)
}
