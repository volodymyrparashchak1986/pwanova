import type { AppView, ReviewView, DeveloperView, DashboardData, AppFilters, RatingBreakdown } from "@/lib/types"
import { rankingScore, trendingScore } from "@/lib/ranking"
import {
  SEED_APPS, SEED_DEVELOPERS, SEED_PARTNERS, SEED_USERS, generateFavorites, generateRatings, uuid, lcg,
} from "@/lib/seed-data"

const DAY = 86_400_000
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString()

interface DemoStore {
  apps: AppView[]
  reviews: Map<string, ReviewView[]> // by app id
  ratings: Map<string, number[]> // by app id
  developers: DeveloperView[]
}

let store: DemoStore | null = null

export function demo(): DemoStore {
  if (store) return store
  const developers: DeveloperView[] = SEED_DEVELOPERS.map((d) => ({
    id: d.id, username: d.username, displayName: d.displayName, avatarUrl: null, bio: d.bio, website: d.website, isVerified: d.verified, isDemo: true,
  }))
  const apps: AppView[] = []
  const reviews = new Map<string, ReviewView[]>()
  const ratings = new Map<string, number[]>()

  SEED_APPS.forEach((s, i) => {
    const id = uuid(4, i + 1)
    const dev = developers.find((d) => d.username === s.developer)!
    const generated = generateRatings(s, i)
    const favs = generateFavorites(s, i)
    const values = generated.map((r) => r.rating)
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const rnd = lcg(i + 300)
    const opens30d = s.opens30d
    const opens7d = Math.round(opens30d * (0.2 + rnd() * 0.15))
    const ratings7d = generated.filter((r) => r.daysAgo < 7).length
    const reviews7d = s.reviews.filter((r) => r.daysAgo < 7).length
    const favorites7d = favs.filter((f) => f.daysAgo < 7).length
    const partner = s.launch?.partner ? SEED_PARTNERS.find((p) => p.slug === s.launch!.partner) : undefined
    const checks = {
      reachable: true, httpsOk: true, responsive: true, mobileOptimized: true,
      manifestOk: s.pwa, serviceWorkerOk: s.serviceWorker, installable: s.installable,
      offlineSupport: s.offline, pushSupport: s.push, securityOk: true, lastCheckedAt: ago(0.08 + rnd() * 0.5),
    }
    const passed = [checks.httpsOk, checks.responsive, checks.mobileOptimized, checks.manifestOk, checks.installable, checks.serviceWorkerOk].filter(Boolean).length
    const app: AppView = {
      id, slug: s.slug, name: s.name, tagline: s.tagline, description: s.description,
      url: `https://${s.slug}.example`, domain: `${s.slug}.example`, iconUrl: null,
      category: s.category, status: "published",
      ownershipStatus: s.verified ? "verified_owner" : "claim_pending",
      verificationStatus: s.verified ? "verified" : "unverified",
      isPwa: s.pwa, isInstallable: s.installable, hostingProvider: s.host, buildTool: s.build,
      healthStatus: "online", isFeatured: Boolean(s.featured), isDemo: true,
      createdAt: ago(s.daysOld), updatedAt: ago(1),
      developer: { id: dev.id, username: dev.username, name: dev.displayName, avatarUrl: null, verified: dev.isVerified },
      rating: Math.round(avg * 100) / 100, ratingsCount: values.length, reviewsCount: s.reviews.length,
      favoritesCount: favs.length, opens7d, opens30d,
      installActions: Math.round(opens30d * 0.35),
      rankingScore: 0, trendingScore: trendingScore({ opens7d, favorites7d, reviews7d, ratings7d }),
      launchSource: s.launch ? { name: s.launch.name, type: s.launch.type, url: s.launch.url ?? partner?.website ?? null, partnerSlug: s.launch.partner ?? null } : null,
      checks, screenshots: [],
    }
    app.rankingScore = rankingScore({
      rating: app.rating, ratingsCount: app.ratingsCount, reviewsCount: app.reviewsCount,
      favoritesCount: app.favoritesCount, opens30d, opens7d, qualityPassed: passed,
    })
    apps.push(app)
    ratings.set(id, values)
    reviews.set(id, s.reviews.map((r, k): ReviewView => {
      const u = SEED_USERS[r.user]
      return {
        id: uuid(5, i * 10 + k + 1), appId: id, userId: u.id, rating: r.rating, title: r.title ?? null, body: r.body,
        helpfulCount: r.helpful, verifiedUser: false, verifiedUsage: false, isDemo: true,
        createdAt: ago(r.daysAgo), updatedAt: ago(r.daysAgo),
        author: { username: u.username, name: u.displayName, avatarUrl: null },
        response: r.response ? { id: uuid(6, i * 10 + k + 1), body: r.response, createdAt: ago(Math.max(0, r.daysAgo - 1)), developerName: dev.displayName } : null,
      }
    }))
  })
  store = { apps, reviews, ratings, developers }
  return store
}

export function filterDemoApps(all: AppView[], f: AppFilters): AppView[] {
  let list = all.filter((a) => a.status === "published")
  if (f.q) {
    const tokens = f.q.toLowerCase().split(/\s+/).filter(Boolean)
    list = list.filter((a) => {
      const hay = [a.name, a.tagline, a.description, a.category, a.buildTool, a.hostingProvider, a.developer.name, a.developer.username, a.launchSource?.name, a.domain]
        .join(" ").toLowerCase().replace(/-/g, " ")
      return tokens.every((t) => hay.includes(t.replace(/-/g, " ")))
    })
  }
  if (f.category) list = list.filter((a) => a.category === f.category)
  if (f.minRating) list = list.filter((a) => a.rating >= f.minRating! && a.ratingsCount > 0)
  if (f.verified) list = list.filter((a) => a.verificationStatus === "verified")
  if (f.installable) list = list.filter((a) => a.isInstallable)
  if (f.pwa) list = list.filter((a) => a.isPwa)
  if (f.build) list = list.filter((a) => a.buildTool === f.build)
  if (f.host) list = list.filter((a) => a.hostingProvider === f.host)
  if (f.launch) list = list.filter((a) => a.launchSource?.name.toLowerCase() === f.launch!.toLowerCase())
  if (f.developerId) list = list.filter((a) => a.developer.id === f.developerId)
  const sorters: Record<string, (a: AppView, b: AppView) => number> = {
    trending: (a, b) => b.trendingScore - a.trendingScore || b.rankingScore - a.rankingScore,
    top: (a, b) => b.rankingScore - a.rankingScore,
    new: (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
    rating: (a, b) => b.rating - a.rating || b.ratingsCount - a.ratingsCount,
  }
  list = [...list].sort(sorters[f.sort ?? "top"])
  const offset = f.offset ?? 0
  return list.slice(offset, offset + (f.limit ?? 60))
}

export function demoBreakdown(appId: string): RatingBreakdown {
  const values = demo().ratings.get(appId) ?? []
  const count = values.length
  const rows = ([5, 4, 3, 2, 1] as const).map((stars) => {
    const total = values.filter((v) => v === stars).length
    return { stars, total, percent: count ? Math.round((total / count) * 100) : 0 }
  })
  return { average: count ? values.reduce((a, b) => a + b, 0) / count : 0, count, rows }
}

export function demoDashboard(): DashboardData {
  const { apps } = demo()
  const mine = apps.filter((a) => a.developer.username === "novalabs")
  const opens = mine.reduce((s, a) => s + a.opens30d, 0)
  const rnd = lcg(42)
  const series = Array.from({ length: 14 }, (_, i) => {
    const o = Math.round((opens / 30) * (0.7 + rnd() * 0.6) * (0.85 + i * 0.02))
    return { date: new Date(Date.now() - (13 - i) * DAY).toISOString().slice(0, 10), views: Math.round(o * 3.1), opens: o, installActions: Math.round(o * 0.33) }
  })
  const sum = (k: "views" | "opens" | "installActions") => series.reduce((s, d) => s + d[k], 0)
  const ratings = mine.reduce((s, a) => s + a.ratingsCount, 0)
  const views = sum("views")
  const src: [string, number][] = [["pwanova_search", .28], ["homepage", .19], ["product_hunt", .17], ["partner", .1], ["google", .11], ["direct", .09], ["social", .04], ["other", .02]]
  return {
    totals: {
      views, opens: sum("opens"), installActions: sum("installActions"),
      favorites: mine.reduce((s, a) => s + a.favoritesCount, 0), ratings,
      reviews: mine.reduce((s, a) => s + a.reviewsCount, 0),
      averageRating: ratings ? Math.round((mine.reduce((s, a) => s + a.rating * a.ratingsCount, 0) / ratings) * 100) / 100 : 0,
    },
    series,
    trafficSources: src.map(([source, p]) => ({ source, count: Math.round(views * p) })),
    launchSources: Object.entries(mine.reduce<Record<string, number>>((m, a) => ((m[a.launchSource?.name ?? "Direct"] = (m[a.launchSource?.name ?? "Direct"] ?? 0) + 1), m), {})).map(([source, count]) => ({ source, count })),
    topApps: mine.map((a) => ({ name: a.name, slug: a.slug, opens: a.opens30d, views: Math.round(a.opens30d * 3.1) })).sort((a, b) => b.opens - a.opens),
  }
}

export const DEMO_PARTNERS = SEED_PARTNERS
