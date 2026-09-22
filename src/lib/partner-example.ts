import type { AppView } from "@/lib/types"

/**
 * A single, static, clearly-fictional listing used ONLY by the Partner Kit's demonstrations
 * (/partners generator fallback, /partners/demo, /api/badge/_example, /embed/app/_example).
 *
 * It lives in code, not in the database, so the Partner Kit keeps working after `supabase/unseed.sql`
 * has removed every fabricated row from a real project. The slug starts with an underscore, which the
 * apps.slug CHECK constraint (`^[a-z0-9-]{2,80}$`) never allows for a real listing, so it can't collide
 * with — or be claimed as — a real app, and it is never returned by getAppBySlug()/the public API.
 */
export const EXAMPLE_SLUG = "_example"

export const exampleApp: AppView = {
  id: "00000000-0000-4000-8000-00000000e0e0",
  slug: EXAMPLE_SLUG,
  name: "Metro Fit",
  tagline: "Team fitness tracking and challenges.",
  description: "A fictional app used to demonstrate the PWANova Partner Kit. It has no real site, no real ratings and no real developer.",
  url: "https://metro-fit.example",
  domain: "metro-fit.example",
  iconUrl: null,
  category: "fitness",
  status: "published",
  ownershipStatus: "verified_owner",
  verificationStatus: "verified",
  isPwa: true,
  isInstallable: true,
  hostingProvider: "vercel",
  buildTool: "claude-code",
  healthStatus: "online",
  isFeatured: false,
  isDemo: true, // every badge/embed rendered from it says "demo data"
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  developer: { id: null, username: null, name: "Example Studio", avatarUrl: null, verified: false },
  rating: 4.8,
  ratingsCount: 52,
  reviewsCount: 3,
  favoritesCount: 56,
  opens7d: 0,
  opens30d: 0,
  installActions: 0,
  rankingScore: 0,
  trendingScore: 0,
  launchSource: { name: "Product Hunt", type: "launched_on", url: null, partnerSlug: null },
  checks: null,
  screenshots: [],
}

export const isExampleSlug = (slug: string) => slug === EXAMPLE_SLUG
