import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/env"
import { mapEvidence, mapFact } from "./catalog"
import type { AppFact, EvidenceItem, OwnershipStatus, SourceType, VerificationState } from "@/lib/v2/types"

export interface MakerAppSummary {
  id: string; slug: string; name: string; domain: string; iconUrl: string | null; status: string; ownershipStatus: OwnershipStatus
  verificationState: VerificationState; evidenceScore: number; profileCompleteness: number; moderationNote: string | null; evidenceCheckedAt: string | null
}

/** Every listing the signed-in person manages, whatever its moderation status (row level security allows owners to read theirs). */
export async function getMakerApps(userId: string): Promise<MakerAppSummary[]> {
  if (!isSupabaseConfigured) return []
  const sb = await createClient()
  const { data } = await sb.from("apps")
    .select("id, slug, name, domain, icon_url, status, ownership_status, verification_state, evidence_score, profile_completeness, moderation_note, evidence_checked_at")
    .eq("developer_id", userId).is("duplicate_of", null).order("created_at", { ascending: false })
  return (data ?? []).map((a) => ({
    id: a.id, slug: a.slug, name: a.name, domain: a.domain, iconUrl: a.icon_url, status: a.status, ownershipStatus: a.ownership_status as OwnershipStatus,
    verificationState: a.verification_state as VerificationState, evidenceScore: a.evidence_score, profileCompleteness: a.profile_completeness,
    moderationNote: a.moderation_note, evidenceCheckedAt: a.evidence_checked_at,
  }))
}

export interface Sourced { sourceType: SourceType; sourceUrl: string | null }
export interface MakerApp extends MakerAppSummary {
  url: string; tagline: string; description: string; contentLocale: string; taglineDe: string; descriptionDe: string
  categorySlug: string | null; useCases: string[]; pricingModel: string; hasFreePlan: boolean | null; hasFreeTrial: boolean | null
  startingPriceCents: number | null; priceCurrency: string | null; aliases: string[]; nextCheckAt: string | null
  company: { name: string; countryCode: string | null } | null
  languages: (Sourced & { code: string })[]
  platforms: (Sourced & { platform: string })[]
  integrations: (Sourced & { slug: string; name: string })[]
  pricingPlans: (Sourced & { id: string; name: string; billingInterval: string; priceCents: number | null; currency: string | null; perUser: boolean; description: string | null })[]
  dataLocations: (Sourced & { id: string; region: string; countryCode: string | null; description: string | null; isDefault: boolean })[]
  subprocessors: (Sourced & { id: string; name: string; purpose: string | null; countryCode: string | null })[]
  aiProviders: (Sourced & { id: string; provider: string; modelName: string | null; purpose: string | null })[]
  alternatives: (Sourced & { slug: string; name: string })[]
  facts: AppFact[]
  statements: EvidenceItem[]
  updates: { id: string; kind: string; title: string; status: string; publishedAt: string | null; createdAt: string }[]
  launches: { id: string; slug: string; headline: string; status: string; launchDate: string; windowEnd: string | null; moderationNote: string | null }[]
  report: { score: number; done: string[]; missing: string[] }
  entitlements: { id: string; plan: string; startsAt: string; endsAt: string | null; appWide: boolean }[]
  screenshots: number
}

const src = (r: { source_type: string; source_url: string | null }): Sourced => ({ sourceType: r.source_type as SourceType, sourceUrl: r.source_url })

/** One listing with everything its maker can see and edit. Returns null when it is not theirs. */
export async function getMakerApp(slug: string, userId: string): Promise<MakerApp | null> {
  if (!isSupabaseConfigured || !/^[a-z0-9-]{1,80}$/.test(slug)) return null
  const sb = await createClient()
  const { data: a } = await sb.from("apps").select("*, category:categories!apps_primary_category_id_fkey(slug), company:companies(name, country_code)").eq("slug", slug).eq("developer_id", userId).maybeSingle()
  if (!a) return null
  const id = a.id
  const [translation, useCases, languages, platforms, integrations, plans, locations, subprocessors, ai, alternatives, facts, statements, updates, launches, report, entitlements, shots] = await Promise.all([
    sb.from("app_translations").select("tagline, description").eq("app_id", id).eq("locale", "de").maybeSingle(),
    sb.from("app_use_cases").select("use_case:use_cases(slug)").eq("app_id", id),
    sb.from("app_languages").select("language_code, source_type, source_url").eq("app_id", id).order("language_code"),
    sb.from("app_platforms").select("platform, source_type, source_url").eq("app_id", id).order("platform"),
    sb.from("app_integrations").select("source_type, source_url, integration:integration_catalog(slug, name)").eq("app_id", id),
    sb.from("pricing_plans").select("*").eq("app_id", id).order("sort_order").order("created_at"),
    sb.from("app_data_locations").select("*").eq("app_id", id).order("created_at"),
    sb.from("app_subprocessors").select("*").eq("app_id", id).order("name"),
    sb.from("app_ai_providers").select("*").eq("app_id", id).order("provider"),
    sb.from("app_alternatives").select("alternative_to_slug, alternative_to_name, source_type, source_url").eq("app_id", id).order("alternative_to_name"),
    sb.from("app_facts").select("*").eq("app_id", id),
    sb.from("app_evidence").select("*").eq("app_id", id).eq("submitted_by", userId).order("collected_at", { ascending: false }).limit(100),
    sb.from("app_updates").select("id, kind, title, status, published_at, created_at").eq("app_id", id).order("created_at", { ascending: false }).limit(20),
    sb.from("launches").select("id, slug, headline, status, launch_date, window_end, moderation_note").eq("app_id", id).order("created_at", { ascending: false }).limit(10),
    sb.rpc("my_app_profile_report", { p_app_id: id }),
    sb.from("entitlements").select("id, plan_slug, starts_at, ends_at, app_id, status").eq("user_id", userId).eq("status", "active"),
    sb.from("app_screenshots").select("id", { count: "exact", head: true }).eq("app_id", id),
  ])
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v)
  const category = one(a.category as { slug: string } | { slug: string }[] | null)
  const company = one(a.company as { name: string; country_code: string | null } | { name: string; country_code: string | null }[] | null)
  const r = (report.data ?? {}) as { score?: number; done?: string[]; missing?: string[] }
  return {
    id, slug: a.slug, name: a.name, domain: a.domain, iconUrl: a.icon_url, status: a.status, ownershipStatus: a.ownership_status as OwnershipStatus,
    verificationState: a.verification_state as VerificationState, evidenceScore: a.evidence_score, profileCompleteness: a.profile_completeness,
    moderationNote: a.moderation_note, evidenceCheckedAt: a.evidence_checked_at, url: a.url, tagline: a.tagline ?? "", description: a.description ?? "",
    contentLocale: a.content_locale, taglineDe: translation.data?.tagline ?? "", descriptionDe: translation.data?.description ?? "",
    categorySlug: category?.slug ?? null, useCases: (useCases.data ?? []).flatMap((u) => { const c = one(u.use_case as { slug: string } | { slug: string }[] | null); return c ? [c.slug] : [] }),
    pricingModel: a.pricing_model, hasFreePlan: a.has_free_plan, hasFreeTrial: a.has_free_trial, startingPriceCents: a.starting_price_cents, priceCurrency: a.price_currency,
    aliases: a.aliases ?? [], nextCheckAt: a.next_check_at, company: company ? { name: company.name, countryCode: company.country_code } : null,
    languages: (languages.data ?? []).map((l) => ({ code: l.language_code, ...src(l) })),
    platforms: (platforms.data ?? []).map((p) => ({ platform: p.platform, ...src(p) })),
    integrations: (integrations.data ?? []).flatMap((i) => { const c = one(i.integration as { slug: string; name: string } | { slug: string; name: string }[] | null); return c ? [{ slug: c.slug, name: c.name, ...src(i) }] : [] }),
    pricingPlans: (plans.data ?? []).map((p) => ({ id: p.id, name: p.name, billingInterval: p.billing_interval, priceCents: p.price_cents, currency: p.currency, perUser: p.per_user, description: p.description, ...src(p) })),
    dataLocations: (locations.data ?? []).map((d) => ({ id: d.id, region: d.region, countryCode: d.country_code, description: d.description, isDefault: d.is_default, ...src(d) })),
    subprocessors: (subprocessors.data ?? []).map((d) => ({ id: d.id, name: d.name, purpose: d.purpose, countryCode: d.country_code, ...src(d) })),
    aiProviders: (ai.data ?? []).map((d) => ({ id: d.id, provider: d.provider, modelName: d.model_name, purpose: d.purpose, ...src(d) })),
    alternatives: (alternatives.data ?? []).map((d) => ({ slug: d.alternative_to_slug, name: d.alternative_to_name, ...src(d) })),
    facts: (facts.data ?? []).map(mapFact),
    statements: (statements.data ?? []).map(mapEvidence),
    updates: (updates.data ?? []).map((u) => ({ id: u.id, kind: u.kind, title: u.title, status: u.status, publishedAt: u.published_at, createdAt: u.created_at })),
    launches: (launches.data ?? []).map((l) => ({ id: l.id, slug: l.slug, headline: l.headline, status: l.status, launchDate: l.launch_date, windowEnd: l.window_end, moderationNote: l.moderation_note })),
    report: { score: r.score ?? a.profile_completeness, done: r.done ?? [], missing: r.missing ?? [] },
    entitlements: (entitlements.data ?? []).filter((e) => !e.app_id || e.app_id === id).map((e) => ({ id: e.id, plan: e.plan_slug, startsAt: e.starts_at, endsAt: e.ends_at, appWide: Boolean(e.app_id) })),
    screenshots: shots.count ?? 0,
  }
}

export interface MakerCounters { comparisons: number; followers: number }
/** Counters the v1 dashboard function does not know: how often listings were added to a comparison, and followers. */
export async function getMakerCounters(appIds: string[], days: number): Promise<MakerCounters> {
  if (!isSupabaseConfigured || !appIds.length) return { comparisons: 0, followers: 0 }
  const sb = await createClient()
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const [compare, follows] = await Promise.all([
    sb.from("app_events").select("id", { count: "exact", head: true }).in("app_id", appIds).eq("event_type", "compare_added").gte("created_at", since),
    sb.from("catalog_apps").select("followers_count").in("id", appIds),
  ])
  return { comparisons: compare.count ?? 0, followers: (follows.data ?? []).reduce((s, r) => s + (r.followers_count ?? 0), 0) }
}
