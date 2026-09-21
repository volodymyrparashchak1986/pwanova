import type { CategorySlug, BuildTool, HostProvider } from "./constants"

export type OwnershipStatus = "unclaimed" | "claim_pending" | "verified_owner"
export type VerificationStatus = "unverified" | "verified" | "failed"
export type AppStatus = "pending" | "published" | "hidden" | "suspended"
export type HealthStatus = "online" | "degraded" | "offline" | "unknown"

/** Flat read model of the `apps_public` view. */
export interface AppView {
  id: string
  slug: string
  name: string
  tagline: string
  description: string
  url: string
  domain: string
  iconUrl: string | null
  category: CategorySlug
  status: AppStatus
  ownershipStatus: OwnershipStatus
  verificationStatus: VerificationStatus
  isPwa: boolean
  isInstallable: boolean
  hostingProvider: HostProvider
  buildTool: BuildTool
  healthStatus: HealthStatus
  isFeatured: boolean
  isDemo: boolean
  createdAt: string
  updatedAt: string
  developer: { id: string | null; username: string | null; name: string | null; avatarUrl: string | null; verified: boolean }
  rating: number
  ratingsCount: number
  reviewsCount: number
  favoritesCount: number
  opens7d: number
  opens30d: number
  installActions: number
  rankingScore: number
  trendingScore: number
  launchSource: { name: string; type: "launched_on" | "discovered_via"; url: string | null; partnerSlug: string | null } | null
  checks: AppChecks | null
  screenshots: string[]
}

export interface AppChecks {
  reachable: boolean | null
  httpsOk: boolean | null
  responsive: boolean | null
  mobileOptimized: boolean | null
  manifestOk: boolean | null
  serviceWorkerOk: boolean | null
  installable: boolean | null
  offlineSupport: boolean | null
  pushSupport: boolean | null
  securityOk: boolean | null
  lastCheckedAt: string | null
}

export interface ReviewView {
  id: string
  appId: string
  userId: string
  rating: number
  title: string | null
  body: string
  helpfulCount: number
  verifiedUser: boolean
  verifiedUsage: boolean
  isDemo: boolean
  createdAt: string
  updatedAt: string
  author: { username: string; name: string; avatarUrl: string | null }
  response: { id: string; body: string; createdAt: string; developerName: string } | null
  helpfulByMe?: boolean
}

export interface DeveloperView {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  bio: string | null
  website: string | null
  isVerified: boolean
  isDemo: boolean
}

export interface Viewer {
  id: string
  email: string | null
  username: string
  displayName: string
  avatarUrl: string | null
  role: "user" | "developer" | "admin" | "partner"
}

export interface RatingBreakdown {
  average: number
  count: number
  rows: { stars: 5 | 4 | 3 | 2 | 1; total: number; percent: number }[]
}

export interface AppFilters {
  q?: string
  category?: string
  minRating?: number
  verified?: boolean
  installable?: boolean
  pwa?: boolean
  build?: string
  host?: string
  launch?: string
  sort?: "trending" | "top" | "new" | "rating"
  limit?: number
  offset?: number
  developerId?: string
}

export interface DashboardData {
  totals: { views: number; opens: number; installActions: number; favorites: number; ratings: number; reviews: number; averageRating: number }
  series: { date: string; views: number; opens: number; installActions: number }[]
  trafficSources: { source: string; count: number }[]
  launchSources: { source: string; count: number }[]
  topApps: { name: string; slug: string; opens: number; views: number }[]
}

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string }
