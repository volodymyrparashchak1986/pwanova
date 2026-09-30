import "server-only"
import { NextResponse } from "next/server"
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config"
import { siteUrl } from "@/lib/env"
import { clientIp, rateLimit } from "@/lib/security/rate-limit"
import type { AppFact, CatalogApp, EvidenceItem, FactAttribute } from "./types"

/**
 * Public API, version 1. Read-only, public data only: no e-mail addresses, no account ids, no tokens,
 * nothing about buyer requests. Every fact carries its state and its origin; a fact that is not in the
 * response is unknown, which is not the same as "no".
 */
export const API_VERSION = "1"
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "access-control-max-age": "86400" }

export const preflight = () => new NextResponse(null, { status: 204, headers: CORS })

export function json(body: unknown, init: { status?: number; cache?: string; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: { ...CORS, "cache-control": init.cache ?? "public, s-maxage=300, stale-while-revalidate=3600", "x-pwanova-api": API_VERSION, ...init.headers },
  })
}
export const apiError = (status: number, message: string, headers?: Record<string, string>) => json({ apiVersion: API_VERSION, error: { status, message } }, { status, cache: "no-store", headers })

/** 60 requests a minute per visitor. Returns the response to send when the limit is reached. */
export async function limited(): Promise<NextResponse | null> {
  if (await rateLimit(`api1:${await clientIp()}`, 60, 60)) return null
  return apiError(429, "Rate limit exceeded. Try again in a minute.", { "retry-after": "60" })
}

export const localeOf = (value: string | null): Locale => (isLocale(value) ? value : DEFAULT_LOCALE)

export function appSummary(a: CatalogApp, locale: Locale) {
  return {
    slug: a.slug,
    name: a.name,
    tagline: (locale === "de" && a.taglineDe) || a.tagline,
    website: a.url,
    domain: a.domain,
    category: a.category ? { slug: a.category.slug, name: a.category.name[locale] ?? a.category.name.en } : null,
    company: a.company ? { name: a.company.name, country: a.company.countryCode, inEu: a.company.inEu, origin: a.company.sourceType } : null,
    pricing: { model: a.pricingModel, freePlan: a.hasFreePlan, freeTrial: a.hasFreeTrial, startingPrice: a.startingPriceCents === null ? null : { amount: a.startingPriceCents / 100, currency: a.priceCurrency } },
    platforms: a.platforms,
    languages: a.languages,
    integrations: a.integrations,
    useCases: a.useCases,
    verification: { state: a.verificationState, evidenceCompleteness: a.evidenceScore, lastCheckedAt: a.evidenceCheckedAt },
    ownership: a.ownershipStatus,
    // null, not 0: "no ratings yet" is not a zero-star average
    rating: a.ratingsCount ? { average: a.rating, count: a.ratingsCount } : null,
    reviewsCount: a.reviewsCount,
    facts: Object.fromEntries(Object.entries(a.facts).filter(([, f]) => f.state !== "unknown").map(([key, f]) => [key, {
      state: f.state, origin: f.origin, value: f.value, checkedAt: f.origin === "verified" ? f.checkedAt : null, statedAt: f.origin === "vendor" ? f.statedAt : null,
    }])),
    url: `${siteUrl}/${locale}/apps/${a.slug}`,
    listedAt: a.createdAt,
    updatedAt: a.updatedAt,
  }
}

export function factDetail(f: AppFact) {
  return {
    key: f.key,
    state: f.effectiveState,
    origin: f.origin,
    verified: f.verifiedState === "unknown" ? null : { state: f.verifiedState, value: f.verifiedValue, by: f.verifiedSourceType, source: f.verifiedSourceUrl, at: f.verifiedAt },
    vendorStatement: f.vendorState === "unknown" ? null : { state: f.vendorState, value: f.vendorValue, source: f.vendorSourceUrl, at: f.vendorStatedAt },
    lastAttempt: f.lastAttemptAt ? { at: f.lastAttemptAt, outcome: f.lastAttemptOutcome } : null,
  }
}

export function evidenceItem(e: EvidenceItem) {
  return {
    fact: e.key, state: e.state, value: e.value, origin: e.sourceType, method: e.method, source: e.sourceUrl, sourceTitle: e.sourceTitle,
    excerpt: e.excerpt, status: e.status, firstSeenAt: e.collectedAt, verifiedAt: e.verifiedAt, lastConfirmedAt: e.lastConfirmedAt, confirmations: e.confirmations,
  }
}

export function factDefinition(a: FactAttribute, locale: Locale) {
  return {
    key: a.key, dimension: a.dimension, valueType: a.valueType, label: a.label[locale] ?? a.label.en, description: a.description[locale] ?? a.description.en ?? null,
    expected: a.isExpected, checkedAutomatically: a.autoCheckable,
  }
}
