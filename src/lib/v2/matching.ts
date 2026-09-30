import type { CatalogApp, FactState } from "./types"

/**
 * Deterministic matching of a buyer request against documented facts. No model, no randomness:
 * the same request and the same catalogue always give the same list, and every line of the result
 * says which requirement it refers to and how well it is documented.
 */
export interface RequestCriteria {
  categorySlugs: string[]
  useCaseSlugs: string[]
  languages: string[]
  requiredFacts: string[]
  requiredIntegrations: string[]
  requiredPlatforms: string[]
  budgetMaxCents: number | null
  budgetCurrency: string
}

export type RequirementStatus = "met" | "met_vendor" | "unverified" | "not_met"
export interface RequirementResult { kind: "fact" | "integration" | "platform" | "language" | "budget" | "category" | "use_case"; key: string; status: RequirementStatus }
export interface MatchResult { appId: string; slug: string; score: number; met: number; total: number; requirements: RequirementResult[] }

export const MAX_MATCHES = 5
const POINTS: Record<RequirementStatus, number> = { met: 3, met_vendor: 2, unverified: 0, not_met: 0 }

function factStatus(app: CatalogApp, key: string): RequirementStatus {
  const f = app.facts[key]
  const state: FactState = f?.state ?? "unknown"
  if (state === "yes") return f.origin === "verified" ? "met" : "met_vendor"
  if (state === "no") return "not_met"
  return "unverified" // nobody has checked or stated it: that is not a "no"
}

/** A listed value (language, platform, integration) is a statement of presence. Its absence is unknown, not "no". */
const listed = (list: string[], key: string): RequirementStatus => (list.includes(key) ? "met_vendor" : "unverified")

function budgetStatus(app: CatalogApp, c: RequestCriteria): RequirementStatus | null {
  if (c.budgetMaxCents === null) return null
  if (app.pricingModel === "free" || app.pricingModel === "open_source" || app.hasFreePlan) return "met_vendor"
  if (app.startingPriceCents === null || !app.priceCurrency) return "unverified"
  if (app.priceCurrency !== c.budgetCurrency) return "unverified" // no currency conversion: PWANova does not guess
  return app.startingPriceCents <= c.budgetMaxCents ? "met_vendor" : "not_met"
}

export function evaluate(app: CatalogApp, c: RequestCriteria): MatchResult | null {
  const requirements: RequirementResult[] = []
  const inCategory = c.categorySlugs.some((s) => app.categorySlugs.includes(s))
  const useCases = c.useCaseSlugs.filter((s) => app.useCases.includes(s))

  // The request names a market. A product outside of it is not a candidate, however well documented it is.
  if ((c.categorySlugs.length || c.useCaseSlugs.length) && !inCategory && !useCases.length) return null
  if (inCategory) requirements.push({ kind: "category", key: c.categorySlugs.find((s) => app.categorySlugs.includes(s))!, status: "met" })
  for (const u of c.useCaseSlugs) requirements.push({ kind: "use_case", key: u, status: useCases.includes(u) ? "met_vendor" : "unverified" })

  for (const key of c.requiredFacts) requirements.push({ kind: "fact", key, status: factStatus(app, key) })
  for (const key of c.requiredIntegrations) requirements.push({ kind: "integration", key, status: listed(app.integrations, key) })
  for (const key of c.requiredPlatforms) requirements.push({ kind: "platform", key, status: listed(app.platforms, key) })
  for (const key of c.languages) {
    // "German available" can also be a verified fact
    const fact = key === "de" ? factStatus(app, "german_available") : "unverified"
    requirements.push({ kind: "language", key, status: fact === "met" || fact === "not_met" ? fact : listed(app.languages, key) === "met_vendor" || fact === "met_vendor" ? "met_vendor" : "unverified" })
  }
  const budget = budgetStatus(app, c)
  if (budget) requirements.push({ kind: "budget", key: "budget", status: budget })

  // A documented "no" on a required fact rules the product out. Unknown never does.
  if (requirements.some((r) => r.kind === "fact" && r.status === "not_met")) return null

  const counted = requirements.filter((r) => r.kind !== "category")
  const met = counted.filter((r) => r.status === "met" || r.status === "met_vendor").length
  const score = requirements.reduce((s, r) => s + POINTS[r.status], 0) - requirements.filter((r) => r.status === "not_met").length * 2
  return { appId: app.id, slug: app.slug, score, met, total: counted.length, requirements }
}

/**
 * The short list: at most five products, best documented first. A product needs to document at
 * least a third of what was asked (or simply be in the requested category when nothing else was asked).
 */
export function matchRequest(apps: CatalogApp[], c: RequestCriteria, opts: { max?: number; includeDemo?: boolean } = {}): MatchResult[] {
  const max = opts.max ?? MAX_MATCHES
  const byId = new Map(apps.map((a) => [a.id, a]))
  return apps
    // fabricated sample listings are matched only where sample data is switched on (local development)
    .filter((a) => (opts.includeDemo || !a.isDemo) && a.status === "published")
    .map((a) => evaluate(a, c))
    .filter((m): m is MatchResult => m !== null && (m.total === 0 ? m.score > 0 : m.met * 3 >= m.total))
    .sort((x, y) => {
      const a = byId.get(x.appId)!, b = byId.get(y.appId)!
      return y.score - x.score || y.met - x.met || b.evidenceScore - a.evidenceScore || b.organicScore - a.organicScore || a.slug.localeCompare(b.slug)
    })
    .slice(0, Math.min(max, MAX_MATCHES))
}

/** Contact details belong in the contact section, where they are private. Free text is checked for them. */
const EMAIL = /[a-z0-9._%+-]+\s?(@|\(at\)|\[at\])\s?[a-z0-9.-]+\.[a-z]{2,}/i
const PHONE = /(?:\+|00)\d{1,3}[\s./-]?(?:\(?\d{1,5}\)?[\s./-]?){2,5}\d{2,}|\b0\d{2,5}[\s./-]?\d{3,}[\s./-]?\d{2,}\b/
export const containsContactDetails = (text: string) => EMAIL.test(text) || PHONE.test(text)
