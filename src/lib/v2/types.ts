import type { Locale } from "@/i18n/config"

/** Three states everywhere. "unknown" means nobody has checked or stated it; it never means "no". */
export type FactState = "yes" | "no" | "unknown"
/** Where the effective answer comes from: PWANova's own check or review, or the vendor's statement. */
export type FactOrigin = "verified" | "vendor" | "none"
export type SourceType = "pwanova_observed" | "admin_reviewed" | "vendor_stated" | "user_submitted"
export type VerificationMethod = "automatic" | "manual" | "vendor" | "community"
export type VerificationState = "unverified" | "pending" | "partially_verified" | "evidence_verified" | "stale" | "verification_failed"
export type Dimension = "technical" | "company" | "data" | "ai" | "product"
export type PricingModel = "unknown" | "free" | "freemium" | "subscription" | "one_time" | "usage_based" | "open_source" | "contact_sales"
export type Platform = "web" | "pwa" | "ios" | "android" | "macos" | "windows" | "linux" | "browser_extension"
export type OwnershipStatus = "unclaimed" | "claim_pending" | "verified_owner"
export type Label = Record<string, string>

export interface FactAttribute {
  key: string
  dimension: Dimension
  valueType: "boolean" | "url" | "text" | "country"
  label: Label
  positiveLabel: Label
  negativeLabel: Label
  description: Label
  isExpected: boolean
  isFilterable: boolean
  isCardSignal: boolean
  autoCheckable: boolean
  ttlDays: number
  sortOrder: number
}

/** The short form carried by every catalogue row. */
export interface FactSummary {
  state: FactState
  origin: FactOrigin
  value: string | null
  checkedAt: string | null
  statedAt: string | null
}

/** The full current answer for one attribute of one app, with both layers side by side. */
export interface AppFact {
  key: string
  verifiedState: FactState
  verifiedValue: string | null
  verifiedSourceType: "pwanova_observed" | "admin_reviewed" | null
  verifiedSourceUrl: string | null
  verifiedAt: string | null
  vendorState: FactState
  vendorValue: string | null
  vendorSourceUrl: string | null
  vendorStatedAt: string | null
  effectiveState: FactState
  origin: FactOrigin
  lastAttemptAt: string | null
  lastAttemptOutcome: "found" | "not_found" | "could_not_check" | "skipped" | null
}

export interface EvidenceItem {
  id: string
  key: string
  state: FactState
  value: string | null
  sourceType: SourceType
  method: VerificationMethod
  sourceUrl: string | null
  sourceTitle: string | null
  excerpt: string | null
  status: "pending_review" | "current" | "superseded" | "rejected" | "retracted"
  collectedAt: string
  verifiedAt: string | null
  lastConfirmedAt: string | null
  confirmations: number
  reviewNote: string | null
}

export interface CompanySummary {
  id: string
  slug: string
  name: string
  countryCode: string | null
  inEu: boolean | null
  sourceType: SourceType
}

export interface CatalogApp {
  id: string
  slug: string
  name: string
  tagline: string
  description: string
  contentLocale: string
  taglineDe: string | null
  descriptionDe: string | null
  url: string
  domain: string
  iconUrl: string | null
  status: string
  isDemo: boolean
  isFeatured: boolean
  isPwa: boolean
  hostingProvider: string
  createdAt: string
  updatedAt: string
  developer: { id: string | null; username: string | null; name: string | null; avatarUrl: string | null }
  ownershipStatus: OwnershipStatus
  ownershipVerifiedAt: string | null
  category: { id: string; slug: string; name: Label } | null
  categorySlugs: string[]
  useCases: string[]
  company: CompanySummary | null
  pricingModel: PricingModel
  hasFreePlan: boolean | null
  hasFreeTrial: boolean | null
  startingPriceCents: number | null
  priceCurrency: string | null
  languages: string[]
  platforms: Platform[]
  integrations: string[]
  verificationState: VerificationState
  evidenceScore: number
  evidenceCheckedAt: string | null
  profileCompleteness: number
  facts: Record<string, FactSummary>
  rating: number
  ratingsCount: number
  reviewsCount: number
  favoritesCount: number
  followersCount: number
  updatesCount: number
  opens30d: number
  organicScore: number
}

export interface CategoryInfo {
  id: string
  slug: string
  name: Label
  description: Label
  icon: string | null
  sortOrder: number
  count: number
}

export interface CatalogFilters {
  q?: string
  categories?: string[]
  useCases?: string[]
  integrations?: string[]
  languages?: string[]
  platforms?: string[]
  pricingModels?: string[]
  countries?: string[]
  hosts?: string[]
  facts?: string[]
  verifiedOnly?: boolean
  euCompany?: boolean
  freePlan?: boolean
  freeTrial?: boolean
  ownerVerified?: boolean
  checkedWithinDays?: number
  minRating?: number
  verification?: VerificationState[]
  developerId?: string
}
export type CatalogSort = "relevance" | "recently_verified" | "rating" | "trending" | "new" | "name"

export interface FacetCounts {
  categories: Record<string, number>
  facts: Record<string, number>
  factsVerified: Record<string, number>
  languages: Record<string, number>
  platforms: Record<string, number>
  pricingModels: Record<string, number>
  countries: Record<string, number>
  integrations: Record<string, number>
  useCases: Record<string, number>
  euCompany: number
  freePlan: number
  freeTrial: number
  ownerVerified: number
  checkedRecently: number
  /** Listings with at least one fact that PWANova verified. */
  withVerifiedFacts: number
  total: number
}

export interface PricingPlan {
  id: string
  name: string
  billingInterval: "free" | "month" | "year" | "one_time" | "usage" | "custom"
  priceCents: number | null
  currency: string | null
  perUser: boolean
  description: string | null
  sourceType: SourceType
  sourceUrl: string | null
  verifiedAt: string | null
  updatedAt: string
}

export interface SourcedItem { sourceType: SourceType; sourceUrl: string | null; verifiedAt: string | null }
export interface AppUpdate { id: string; kind: string; title: string; body: string | null; version: string | null; linkUrl: string | null; publishedAt: string | null; status: string }
export interface AlternativeLink { slug: string; name: string; appSlug: string | null; sourceType: SourceType }

export interface AppDetail {
  app: CatalogApp
  facts: AppFact[]
  pricingPlans: PricingPlan[]
  languages: (SourcedItem & { code: string })[]
  platforms: (SourcedItem & { platform: Platform })[]
  integrations: (SourcedItem & { slug: string; name: string })[]
  useCases: { slug: string; name: Label }[]
  categories: { slug: string; name: Label; isPrimary: boolean }[]
  dataLocations: (SourcedItem & { id: string; region: string; countryCode: string | null; description: string | null; isDefault: boolean })[]
  subprocessors: (SourcedItem & { id: string; name: string; purpose: string | null; countryCode: string | null })[]
  aiProviders: (SourcedItem & { id: string; provider: string; modelName: string | null; purpose: string | null })[]
  updates: AppUpdate[]
  alternativeTo: AlternativeLink[]
  screenshots: string[]
}

export interface LaunchItem {
  id: string
  slug: string
  headline: string
  description: string | null
  headlineDe: string | null
  descriptionDe: string | null
  launchDate: string
  windowStart: string | null
  windowEnd: string | null
  inWindow: boolean
  isSponsored: boolean
  app: { id: string; slug: string; name: string; tagline: string; iconUrl: string | null; verificationState: VerificationState; evidenceScore: number; isDemo: boolean }
  maker: { username: string | null; name: string | null }
  signals: { saves: number; follows: number; reviews: number; visitors: number }
  score: number
}

export type LocalizedText = (label: Label | null | undefined, fallback?: string) => string
export type { Locale }
