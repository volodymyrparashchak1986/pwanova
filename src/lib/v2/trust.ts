import { daysSince } from "@/i18n/format"
import type { AppFact, CatalogApp, Dimension, FactAttribute, FactOrigin, FactState, FactSummary } from "./types"

/** Order in which positive facts are offered as card signals. Anything else follows in registry order. */
const CARD_PRIORITY = [
  "eu_company", "eu_hosting_available", "dpa_available", "no_training_on_customer_data", "open_source", "self_hosted",
  "mcp_available", "api_available", "pwa_manifest", "german_available", "free_plan",
]

export interface CardSignal { key: string; origin: Exclude<FactOrigin, "none">; checkedAt: string | null; statedAt: string | null }

/**
 * A small number of high-value signals for a card. Only facts with a "yes" appear: a card never
 * shows a negative or an unknown, and therefore never implies one.
 */
export function pickCardSignals(facts: Record<string, FactSummary>, registry: FactAttribute[], max = 4): CardSignal[] {
  // a country is a value, not a yes: it is shown next to the company name instead of as a signal
  const allowed = new Set(registry.filter((a) => a.isCardSignal && a.valueType !== "country").map((a) => a.key))
  const order = [...CARD_PRIORITY, ...registry.map((a) => a.key).filter((k) => !CARD_PRIORITY.includes(k))]
  const out: CardSignal[] = []
  for (const key of order) {
    const f = facts[key]
    if (!f || !allowed.has(key) || f.state !== "yes" || f.origin === "none") continue
    out.push({ key, origin: f.origin, checkedAt: f.checkedAt, statedAt: f.statedAt })
    if (out.length >= max) break
  }
  return out
}

export type Freshness = "today" | "fresh" | "aging" | "stale" | "never"

/** How current a verified answer is, relative to how often that kind of fact changes. */
export function freshness(checkedAt: string | null | undefined, ttlDays: number, now: number = Date.now()): Freshness {
  const days = daysSince(checkedAt ?? null, now)
  if (days === null) return "never"
  if (days === 0) return "today"
  if (days <= ttlDays) return "fresh"
  if (days <= ttlDays * 2) return "aging"
  return "stale"
}

export const isRecentlyVerified = (checkedAt: string | null | undefined, now: number = Date.now()) => {
  const days = daysSince(checkedAt ?? null, now)
  return days !== null && days <= 30
}

export interface DimensionSummary { dimension: Dimension; expected: number; verified: number; vendor: number; unknown: number }

/** Per dimension: how many expected facts are verified, only stated, or unknown. Descriptive, not a grade. */
export function summarizeDimensions(facts: AppFact[], registry: FactAttribute[]): DimensionSummary[] {
  const byKey = new Map(facts.map((f) => [f.key, f]))
  const order: Dimension[] = ["company", "data", "technical", "ai", "product"]
  return order.map((dimension) => {
    const attrs = registry.filter((a) => a.dimension === dimension && a.isExpected)
    let verified = 0, vendor = 0
    for (const a of attrs) {
      const f = byKey.get(a.key)
      if (f?.origin === "verified") verified++
      else if (f?.origin === "vendor") vendor++
    }
    return { dimension, expected: attrs.length, verified, vendor, unknown: attrs.length - verified - vendor }
  }).filter((d) => d.expected > 0)
}

/** The label that matches the state: "DPA available", "No DPA published", or the neutral name when unknown. */
export function factLabel(attr: FactAttribute, state: FactState, locale: string): string {
  const pickLabel = (l: Record<string, string>) => l[locale] || l.en || ""
  if (state === "yes") return pickLabel(attr.positiveLabel) || pickLabel(attr.label)
  if (state === "no") return pickLabel(attr.negativeLabel) || pickLabel(attr.label)
  return pickLabel(attr.label)
}

/** Facts worth a row in the trust snapshot, in registry order, including the unknown ones. */
export function snapshotFacts(facts: AppFact[], registry: FactAttribute[], keys: string[]): { attr: FactAttribute; fact: AppFact | null }[] {
  const byKey = new Map(facts.map((f) => [f.key, f]))
  return keys.map((k) => registry.find((a) => a.key === k)).filter((a): a is FactAttribute => Boolean(a)).map((attr) => ({ attr, fact: byKey.get(attr.key) ?? null }))
}
export const SNAPSHOT_KEYS = ["company_country", "eu_company", "legal_notice", "privacy_policy", "dpa_available", "eu_hosting_available", "subprocessors_published", "no_training_on_customer_data"]

/** Price indicator for cards: a model, optionally with the stated starting price. */
export function priceSummary(app: Pick<CatalogApp, "pricingModel" | "hasFreePlan" | "startingPriceCents" | "priceCurrency">) {
  const model = app.pricingModel === "unknown" && app.hasFreePlan ? "freemium" : app.pricingModel
  return { model, from: app.startingPriceCents !== null && app.priceCurrency ? { cents: app.startingPriceCents, currency: app.priceCurrency } : null }
}
