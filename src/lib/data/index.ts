/* eslint-disable @typescript-eslint/no-explicit-any -- PostgREST rows are mapped at this boundary */
import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured, showDemoData, demoMode } from "@/lib/env"
import { CATEGORIES } from "@/lib/constants"
import type {
  AppFilters, AppView, DashboardData, DeveloperView, RatingBreakdown, ReviewView, Viewer,
} from "@/lib/types"
import { demo, demoBreakdown, demoDashboard, filterDemoApps, DEMO_PARTNERS } from "./demo"
import { byHelpfulThenNewest, pickReviewHighlights } from "@/lib/reviews"

type Row = any

// ------------------------------------------------------------------ mappers
export function mapApp(r: Row, screenshots: string[] = []): AppView {
  const checked = r.last_checked_at != null
  return {
    id: r.id, slug: r.slug, name: r.name, tagline: r.tagline ?? "", description: r.description ?? "",
    url: r.url, domain: r.domain, iconUrl: r.icon_url, category: r.category, status: r.status,
    ownershipStatus: r.ownership_status, ownershipMethod: r.ownership_method, ownershipVerifiedAt: r.ownership_verified_at, verificationStatus: r.verification_status,
    isPwa: r.is_pwa, isInstallable: r.is_installable, hostingProvider: r.hosting_provider, buildTool: r.build_tool,
    healthStatus: r.health_status, isFeatured: r.is_featured, isDemo: r.is_demo,
    createdAt: r.created_at, updatedAt: r.updated_at,
    developer: { id: r.developer_id, username: r.developer_username, name: r.developer_name, avatarUrl: r.developer_avatar, verified: Boolean(r.developer_verified) },
    rating: Number(r.rating ?? 0), ratingsCount: r.ratings_count ?? 0, reviewsCount: r.reviews_count ?? 0,
    favoritesCount: r.favorites_count ?? 0, opens7d: r.opens_7d ?? 0, opens30d: r.opens_30d ?? 0,
    installActions: r.install_actions ?? 0, rankingScore: Number(r.ranking_score ?? 0), trendingScore: Number(r.trending_score ?? 0),
    launchSource: r.launch_source_name
      ? { name: r.launch_source_name, type: r.launch_source_type, url: r.launch_source_url, partnerSlug: r.launch_partner_slug }
      : null,
    checks: checked
      ? {
          method: r.check_details?.method ?? "unknown", evidence: r.check_details?.evidence ?? {}, reachable: r.reachable, httpsOk: r.https_ok, responsive: r.responsive, mobileOptimized: r.mobile_optimized,
          manifestOk: r.manifest_ok, serviceWorkerOk: r.service_worker_ok, installable: r.check_installable,
          offlineSupport: r.offline_support, pushSupport: r.push_support, securityOk: r.security_ok, lastCheckedAt: r.last_checked_at,
        }
      : null,
    screenshots,
  }
}

// ------------------------------------------------------------------ apps
export async function getApps(f: AppFilters = {}): Promise<AppView[]> {
  if (!isSupabaseConfigured) return demoMode ? filterDemoApps(demo().apps, f) : []
  const sb = await createClient()
  let q = sb.from("apps_public").select("*")
  if (!showDemoData) q = q.eq("is_demo", false) // fabricated seed rows never appear in real listings, search, rankings or the sitemap
  if (f.q) {
    for (const t of f.q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6)) {
      const safe = t.replace(/[^a-z0-9.\-_ ]/g, "")
      if (safe) q = q.ilike("search_text", `%${safe}%`)
    }
  }
  if (f.category) q = q.eq("category", f.category)
  if (f.minRating) q = q.gte("rating", f.minRating).gt("ratings_count", 0)
  if (f.verified) q = q.eq("ownership_status", "verified_owner")
  if (f.installable) q = q.eq("is_installable", true)
  if (f.pwa) q = q.eq("is_pwa", true)
  if (f.build) q = q.eq("build_tool", f.build)
  if (f.host) q = q.eq("hosting_provider", f.host)
  if (f.launch) q = q.ilike("launch_source_name", f.launch.replace(/[%_]/g, ""))
  if (f.developerId) q = q.eq("developer_id", f.developerId)
  const sort = f.sort ?? "top"
  // "top" (the default catalog order) pins editorially featured listings first, then ranks by score.
  q = sort === "trending" ? q.order("trending_score", { ascending: false }).order("ranking_score", { ascending: false })
    : sort === "new" ? q.order("created_at", { ascending: false })
    : sort === "rating" ? q.order("ranking_score", { ascending: false }).order("ratings_count", { ascending: false })
    : q.order("is_featured", { ascending: false }).order("ranking_score", { ascending: false }).order("featured_at", { ascending: true, nullsFirst: false })
  const offset = f.offset ?? 0
  const { data, error } = await q.range(offset, offset + (f.limit ?? 60) - 1)
  if (error) { console.error("getApps", error.message); return [] }
  return (data ?? []).map((r) => mapApp(r))
}

export async function getFeaturedApps(limit = 6): Promise<AppView[]> {
  if (!isSupabaseConfigured) return demoMode ? demo().apps.filter((a) => a.isFeatured).slice(0, limit) : []
  const sb = await createClient()
  let q = sb.from("apps_public").select("*").eq("is_featured", true)
  if (!showDemoData) q = q.eq("is_demo", false)
  const { data } = await q.order("ranking_score", { ascending: false }).order("featured_at", { ascending: true, nullsFirst: false }).limit(limit)
  const rows = (data ?? []).map((r) => mapApp(r))
  return rows.length ? rows : getApps({ sort: "top", limit })
}

export const getAppBySlug = cache(async (slug: string): Promise<AppView | null> => {
  if (!isSupabaseConfigured) return demoMode ? demo().apps.find((a) => a.slug === slug) ?? null : null
  const sb = await createClient()
  const { data } = await sb.from("apps_public").select("*").eq("slug", slug).maybeSingle()
  if (!data || (data.is_demo && !showDemoData)) return null
  const { data: shots } = await sb.from("app_screenshots").select("image_url").eq("app_id", data.id).order("sort_order")
  return mapApp(data, (shots ?? []).map((s: Row) => s.image_url))
})

/** Backs the public partner API. Demo/fabricated apps are excluded unless SHOW_DEMO_DATA=true: a real
 *  launch board must never receive fake ratings for a domain it doesn't actually control the truth of. */
export async function getAppByDomain(domain: string, canonicalUrl?: string, appId?: string): Promise<AppView | null> {
  const d = domain.toLowerCase()
  if (!isSupabaseConfigured) return demoMode ? demo().apps.find((a) => a.domain.replace(/^www\./, "") === d) ?? null : null
  const sb = await createClient()
  let q = sb.from("apps_public").select("*")
  q = appId ? q.eq("id", appId) : canonicalUrl ? q.eq("canonical_url", canonicalUrl) : q.eq("domain", d)
  if (!showDemoData) q = q.eq("is_demo", false)
  const { data } = await q.limit(2)
  if (data && data.length > 1) throw new Error("AMBIGUOUS_DOMAIN")
  return data?.[0] ? mapApp(data[0]) : null
}

export async function getCategoryCounts(): Promise<Record<string, number>> {
  const apps = isSupabaseConfigured ? await getApps({ limit: 1000 }) : demoMode ? demo().apps : []
  const out: Record<string, number> = Object.fromEntries(CATEGORIES.map((c) => [c.slug, 0]))
  for (const a of apps) out[a.category] = (out[a.category] ?? 0) + 1
  return out
}

export async function getRatingBreakdown(app: AppView): Promise<RatingBreakdown> {
  if (!isSupabaseConfigured) return demoBreakdown(app.id)
  const sb = await createClient()
  const { data } = await sb.rpc("rating_breakdown", { p_app_id: app.id })
  const count = app.ratingsCount
  const rows = ([5, 4, 3, 2, 1] as const).map((stars) => {
    const total = Number((data ?? []).find((r: Row) => r.stars === stars)?.total ?? 0)
    return { stars, total, percent: count ? Math.round((total / count) * 100) : 0 }
  })
  return { average: app.rating, count, rows }
}

const REVIEW_SELECT = "*, author:profiles!reviews_user_id_fkey(username, display_name, avatar_url), response:developer_responses(id, body, created_at, developer:profiles(display_name, username))"

function mapReview(r: Row, mine: Set<string> = new Set()): ReviewView {
  const resp = Array.isArray(r.response) ? r.response[0] : r.response
  return {
    hiddenAt: r.hidden_at ?? null, moderationReason: r.moderation_reason ?? null, id: r.id, appId: r.app_id, userId: r.user_id, rating: r.rating, title: r.title, body: r.body,
    helpfulCount: r.helpful_count, verifiedUser: r.verified_user, verifiedUsage: r.verified_usage, isDemo: r.is_demo,
    createdAt: r.created_at, updatedAt: r.updated_at,
    author: { username: r.author?.username ?? "user", name: r.author?.display_name ?? r.author?.username ?? "User", avatarUrl: r.author?.avatar_url ?? null },
    response: resp ? { id: resp.id, body: resp.body, createdAt: resp.created_at, developerName: resp.developer?.display_name ?? resp.developer?.username ?? "Developer" } : null,
    helpfulByMe: mine.has(r.id),
  }
}

// ------------------------------------------------------------------ reviews
export async function getReviews(app: AppView, viewerId?: string | null): Promise<ReviewView[]> {
  if (!isSupabaseConfigured) {
    if (!demoMode) return []
    return [...(demo().reviews.get(app.id) ?? [])].sort((a, b) => b.helpfulCount - a.helpfulCount)
  }
  const sb = await createClient()
  const { data } = await sb
    .from("reviews")
    .select("*, author:profiles!reviews_user_id_fkey(username, display_name, avatar_url), response:developer_responses(id, body, created_at, developer:profiles(display_name, username))")
    .eq("app_id", app.id)
    .is("hidden_at", null)
    .eq("is_demo", showDemoData && app.isDemo)
    .order("helpful_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50)
  // The user's own review must remain editable even beyond the first 50 public results.
  if (viewerId && viewerId !== app.developer.id) {
    const { data: own } = await sb.from("reviews")
      .select("*, author:profiles!reviews_user_id_fkey(username, display_name, avatar_url), response:developer_responses(id, body, created_at, developer:profiles(display_name, username))")
      .eq("app_id", app.id).eq("user_id", viewerId).maybeSingle()
    if (own && data && !data.some((r: Row) => r.id === own.id) && (!own.is_demo || showDemoData)) data.unshift(own)
  }
  let mine = new Set<string>()
  if (viewerId && data?.length) {
    const { data: votes } = await sb.from("review_helpful").select("review_id").eq("user_id", viewerId).in("review_id", data.map((r: Row) => r.id))
    mine = new Set((votes ?? []).map((v: Row) => v.review_id))
  }
  return (data ?? []).filter((r: Row) => r.user_id !== app.developer.id).map((r: Row) => mapReview(r, mine))
}

export interface CommunityReviews { app: AppView; reviews: ReviewView[] }

/**
 * Real reviews of the top apps for the home page: up to `perApp` per app, most helpful first.
 * Nothing is fabricated here. When nobody has written a review yet the arrays are simply empty,
 * and the UI says so instead of inventing social proof.
 */
export async function getCommunityReviews(appsLimit = 3, perApp = 3): Promise<CommunityReviews[]> {
  const apps = await getApps({ sort: "top", limit: appsLimit })
  if (!apps.length) return []
  if (!isSupabaseConfigured) {
    if (!demoMode) return apps.map((app) => ({ app, reviews: [] }))
    return apps.map((app) => ({ app, reviews: [...(demo().reviews.get(app.id) ?? [])].sort(byHelpfulThenNewest).slice(0, perApp) }))
  }
  const sb = await createClient()
  const ids = apps.map((a) => a.id)
  let q = sb.from("reviews").select(REVIEW_SELECT).in("app_id", ids).is("hidden_at", null)
    .order("helpful_count", { ascending: false }).order("created_at", { ascending: false }).limit(appsLimit * 20)
  if (!showDemoData) q = q.eq("is_demo", false)
  const { data, error } = await q
  if (error) { console.error("getCommunityReviews", error.message); return apps.map((app) => ({ app, reviews: [] })) }
  const developerOf = new Map(apps.map((a) => [a.id, a.developer.id]))
  const rows = (data ?? []).filter((r: Row) => r.user_id !== developerOf.get(r.app_id)).map((r: Row) => mapReview(r))
  const picked = pickReviewHighlights(rows, ids, perApp)
  return apps.map((app) => ({ app, reviews: picked.get(app.id) ?? [] }))
}

export async function getViewerAppState(appId: string, viewerId: string | null) {
  const empty = { myRating: null as number | null, favorited: false }
  if (!viewerId || !isSupabaseConfigured) return empty
  const sb = await createClient()
  const [{ data: rating }, { data: fav }] = await Promise.all([
    sb.from("ratings").select("rating").eq("app_id", appId).eq("user_id", viewerId).maybeSingle(),
    sb.from("favorites").select("id").eq("app_id", appId).eq("user_id", viewerId).maybeSingle(),
  ])
  return { myRating: rating?.rating ?? null, favorited: Boolean(fav) }
}

// ------------------------------------------------------------------ developers
export async function getDeveloper(username: string): Promise<DeveloperView | null> {
  if (!isSupabaseConfigured) return demoMode ? demo().developers.find((d) => d.username === username) ?? null : null
  const sb = await createClient()
  const { data } = await sb.from("profiles").select("*").eq("username", username.toLowerCase()).maybeSingle()
  if (!data || (data.is_demo && !showDemoData)) return null
  return { id: data.id, username: data.username, displayName: data.display_name ?? data.username, avatarUrl: data.avatar_url, bio: data.bio, website: data.website, isVerified: data.is_verified, isDemo: data.is_demo }
}

// ------------------------------------------------------------------ viewer
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!isSupabaseConfigured) return null
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const { data: p } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle()
  return {
    id: user.id, email: user.email ?? null, username: p?.username ?? "user",
    displayName: p?.display_name ?? p?.username ?? "You", avatarUrl: p?.avatar_url ?? null, role: p?.role ?? "user",
  }
})

export async function getSavedApps(userId: string): Promise<AppView[]> {
  const sb = await createClient()
  const { data: favs } = await sb.from("favorites").select("app_id").eq("user_id", userId).order("created_at", { ascending: false })
  const ids = (favs ?? []).map((f: Row) => f.app_id)
  if (!ids.length) return []
  const { data } = await sb.from("apps_public").select("*").in("id", ids)
  const byId = new Map((data ?? []).filter((r: Row) => showDemoData || !r.is_demo).map((r: Row) => [r.id, mapApp(r)]))
  return ids.map((id: string) => byId.get(id)).filter(Boolean) as AppView[]
}

export interface MyApp {
  id: string; slug: string; name: string; domain: string; url: string; iconUrl: string | null; status: string
  ownershipStatus: AppView["ownershipStatus"]; verificationStatus: AppView["verificationStatus"]; category: string
  moderationNote: string | null
}
export async function getMyApps(userId: string): Promise<MyApp[]> {
  const sb = await createClient()
  const { data } = await sb.from("apps").select("id, slug, name, domain, url, icon_url, status, ownership_status, verification_status, category, moderation_note").eq("developer_id", userId).order("created_at", { ascending: false })
  return (data ?? []).map((r: Row) => ({ id: r.id, slug: r.slug, name: r.name, domain: r.domain, url: r.url, iconUrl: r.icon_url, status: r.status, ownershipStatus: r.ownership_status, verificationStatus: r.verification_status, category: r.category, moderationNote: r.moderation_note }))
}

export interface OwnedApp { url: string; id: string; slug: string; name: string; domain: string; iconUrl: string | null; status: string; ownershipStatus: AppView["ownershipStatus"]; ownerId: string; moderationNote: string | null }
/** The caller's own app regardless of moderation status (RLS lets owners read their unpublished apps). */
export async function getOwnedAppBySlug(slug: string, userId: string): Promise<OwnedApp | null> {
  if (!isSupabaseConfigured) return null
  const sb = await createClient()
  const { data } = await sb.from("apps").select("id, slug, name, url, domain, icon_url, status, ownership_status, developer_id, moderation_note").eq("slug", slug).eq("developer_id", userId).maybeSingle()
  return data ? { url: data.url, id: data.id, slug: data.slug, name: data.name, domain: data.domain, iconUrl: data.icon_url, status: data.status, ownershipStatus: data.ownership_status, ownerId: data.developer_id, moderationNote: data.moderation_note } : null
}

export async function getDashboard(days: 7 | 30 = 30): Promise<DashboardData> {
  if (!isSupabaseConfigured && demoMode) return demoDashboard()
  if (!isSupabaseConfigured) return { totals: { views: 0, opens: 0, installActions: 0, favorites: 0, ratings: 0, reviews: 0, averageRating: 0 }, series: [], trafficSources: [], launchSources: [], topApps: [] }
  const sb = await createClient()
  const { data, error } = await sb.rpc("developer_dashboard", { p_days: days })
  if (error || !data) {
    return { totals: { views: 0, opens: 0, installActions: 0, favorites: 0, ratings: 0, reviews: 0, averageRating: 0 }, series: [], trafficSources: [], launchSources: [], topApps: [] }
  }
  return data as DashboardData
}

export async function getActivity(userId: string) {
  const sb = await createClient()
  const [{ data: reviews }, { data: favs }] = await Promise.all([
    sb.from("reviews").select("id, rating, title, body, created_at, app:apps(name, slug), response:developer_responses(body, created_at)").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    sb.from("favorites").select("created_at, app:apps(name, slug)").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
  ])
  return { reviews: (reviews ?? []) as Row[], favorites: (favs ?? []) as Row[] }
}

// ------------------------------------------------------------------ partners
export async function getPartnerByRef(ref: string) {
  const r = ref.toLowerCase()
  if (!isSupabaseConfigured) {
    if (!demoMode) return null
    const p = DEMO_PARTNERS.find((x) => x.slug === r || x.referralCode.toLowerCase() === r)
    return p ? { id: p.id, name: p.name, slug: p.slug } : null
  }
  const sb = await createClient()
  const { data } = await sb.from("partners").select("id, name, slug").eq("status", "active").eq("is_demo", false).or(`slug.eq.${r.replace(/[^a-z0-9_-]/g, "")},referral_code.eq.${r.replace(/[^a-z0-9_-]/g, "")}`).limit(1).maybeSingle()
  return data as { id: string; name: string; slug: string } | null
}

// ------------------------------------------------------------------ admin
export async function getAdminOverview() {
  const sb = await createClient()
  const [{ data: reports }, { data: apps }, { data: auditLog }] = await Promise.all([
    sb.from("reports").select("id, reason, details, status, created_at, app:apps(id, name, slug), review:reviews(id, body, app_id)").in("status", ["open", "reviewing"]).order("created_at", { ascending: false }).limit(50),
    sb.from("apps").select("id, name, slug, status, verification_status, ownership_status, is_featured, domain, is_demo, moderation_note").order("created_at", { ascending: false }).limit(200),
    sb.from("admin_actions").select("id, action, target_type, target_id, reason, created_at, admin:profiles(username, display_name)").order("created_at", { ascending: false }).limit(30),
  ])
  const all = (apps ?? []) as Row[]
  return {
    reports: (reports ?? []) as Row[],
    pending: all.filter((a) => a.status === "pending"),
    apps: all,
    auditLog: (auditLog ?? []) as Row[],
  }
}

export async function getSitemapData() {
  const apps = await getApps({ limit: 1000, sort: "new" })
  const devs = Array.from(new Set(apps.map((a) => a.developer.username).filter(Boolean))) as string[]
  return { apps, devs }
}
