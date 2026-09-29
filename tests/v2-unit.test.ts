/**
 * V2 rules that need no database: addresses, languages, comparison keys, trust display,
 * deterministic matching, and link discovery. Pure functions, no network.
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { DEFAULT_LOCALE, isUnprefixedPath, languageAlternates, legacyTarget, localizeHref, negotiateLocale, splitLocale, switchLocale } from "../src/i18n/config"
import { de } from "../src/i18n/dictionaries/de"
import { en } from "../src/i18n/dictionaries/en"
import { CLIENT_NAMESPACES, SCOPED_NAMESPACES } from "../src/i18n/dictionaries"
import { daysSince, fmt, formatPrice, pick, plural } from "../src/i18n/format"
import { collectionCount, COLLECTION_SLUGS, COLLECTIONS, isCollection } from "../src/lib/v2/collections"
import { comparisonCandidates, comparisonKey, comparisonSlugs, isCanonicalKey, isIndexableComparison, MAX_COMPARE, parseComparisonKey } from "../src/lib/v2/compare"
import { containsContactDetails, evaluate, matchRequest, type RequestCriteria } from "../src/lib/v2/matching"
import { NOT_STATEABLE, REQUESTABLE_FACTS, STATEABLE_CAPABILITIES } from "../src/lib/v2/options"
import { activeFilterCount, apiCatalogParams, catalogHref, catalogQuery, isIndexableCatalog, parseCatalogParams } from "../src/lib/v2/params"
import { excerpt, localizedText } from "../src/lib/v2/text"
import { factLabel, freshness, isRecentlyVerified, pickCardSignals, priceSummary, summarizeDimensions } from "../src/lib/v2/trust"
import type { AppFact, CatalogApp, FacetCounts, FactAttribute, FactSummary } from "../src/lib/v2/types"

// ------------------------------------------------------------------ fixtures
const attr = (key: string, o: Partial<FactAttribute> = {}): FactAttribute => ({
  key, dimension: "data", valueType: "boolean", label: { en: key, de: `${key}-de` }, positiveLabel: { en: `${key} yes`, de: `${key} ja` },
  negativeLabel: { en: `${key} no` }, description: {}, isExpected: true, isFilterable: true, isCardSignal: true, autoCheckable: false, ttlDays: 90, sortOrder: 1, ...o,
})
const summary = (state: FactSummary["state"], origin: FactSummary["origin"]): FactSummary => ({ state, origin, value: null, checkedAt: origin === "verified" ? "2026-09-01T00:00:00Z" : null, statedAt: origin === "vendor" ? "2026-09-01T00:00:00Z" : null })
const app = (slug: string, o: Partial<CatalogApp> = {}): CatalogApp => ({
  id: `id-${slug}`, slug, name: slug, tagline: "A tagline", description: "A description", contentLocale: "en", taglineDe: null, descriptionDe: null, url: `https://${slug}.example/`,
  domain: `${slug}.example`, iconUrl: null, status: "published", isDemo: false, isFeatured: false, isPwa: false, hostingProvider: "other", createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z", developer: { id: null, username: null, name: null, avatarUrl: null }, ownershipStatus: "unclaimed", ownershipVerifiedAt: null,
  category: { id: "c1", slug: "finance", name: { en: "Finance" } }, categorySlugs: ["finance"], useCases: [], company: null, pricingModel: "unknown", hasFreePlan: null,
  hasFreeTrial: null, startingPriceCents: null, priceCurrency: null, languages: [], platforms: ["web"], integrations: [], verificationState: "unverified", evidenceScore: 0,
  evidenceCheckedAt: null, profileCompleteness: 0, facts: {}, rating: 0, ratingsCount: 0, reviewsCount: 0, favoritesCount: 0, followersCount: 0, updatesCount: 0, opens30d: 0,
  organicScore: 0, ...o,
})
const criteria = (o: Partial<RequestCriteria> = {}): RequestCriteria => ({
  categorySlugs: [], useCaseSlugs: [], languages: [], requiredFacts: [], requiredIntegrations: [], requiredPlatforms: [], budgetMaxCents: null, budgetCurrency: "EUR", ...o,
})

// ------------------------------------------------------------------ languages and addresses
describe("language editions", () => {
  it("every page has an address in each language and keeps its path when the language changes", () => {
    assert.equal(localizeHref("/discover", "de"), "/de/discover")
    assert.equal(localizeHref("/", "en"), "/en")
    assert.equal(localizeHref("/apps/x?from=home#reviews", "de"), "/de/apps/x?from=home#reviews")
    assert.equal(switchLocale("/en/apps/metro-fit/evidence", "de"), "/de/apps/metro-fit/evidence")
    assert.equal(switchLocale("/de", "en"), "/en")
    assert.deepEqual(splitLocale("/de/compare/a-vs-b"), { locale: "de", path: "/compare/a-vs-b" })
    assert.deepEqual(splitLocale("/compare"), { locale: null, path: "/compare" })
  })

  it("leaves addresses alone that exist once: APIs, sign-in callbacks, embeds, assets, other sites", () => {
    for (const href of ["/api/v1/apps", "/auth/callback", "/embed/app/x", "/offline", "/icons/icon-192.png", "https://example.org/x", "//example.org/x", "mailto:a@b.example", "#top"]) {
      assert.equal(localizeHref(href, "de"), href, href)
    }
    assert.equal(localizeHref("/en/pricing", "de"), "/en/pricing", "an explicit language is kept")
    assert.ok(isUnprefixedPath("/sitemap.xml") && isUnprefixedPath("/robots.txt") && !isUnprefixedPath("/apps/x") && !isUnprefixedPath("/apiary"))
  })

  it("chooses the language somebody picked, then the browser's, then the default", () => {
    assert.equal(negotiateLocale("de-DE,de;q=0.9,en;q=0.8", null), "de")
    assert.equal(negotiateLocale("fr-FR,fr;q=0.9,de;q=0.5,en;q=0.4", null), "de")
    assert.equal(negotiateLocale("fr-FR,fr;q=0.9", null), DEFAULT_LOCALE)
    assert.equal(negotiateLocale("de-DE", "en"), "en", "an earlier choice wins over the browser")
    assert.equal(negotiateLocale("de;q=0,en;q=0.1", null), "en", "q=0 means not acceptable")
    assert.equal(negotiateLocale(null, "xx"), DEFAULT_LOCALE)
    assert.equal(negotiateLocale("x".repeat(5000), undefined), DEFAULT_LOCALE)
  })

  it("names every language edition of a page, and a default", () => {
    assert.deepEqual(languageAlternates("/apps/x", "https://pwanova.example").languages, {
      en: "https://pwanova.example/en/apps/x", de: "https://pwanova.example/de/apps/x", "x-default": "https://pwanova.example/en/apps/x",
    })
    assert.equal(languageAlternates("/", "https://pwanova.example").languages.de, "https://pwanova.example/de")
  })

  it("sends every v1 address to where the page lives now", () => {
    assert.deepEqual(legacyTarget("/explore"), { path: "/discover" })
    assert.deepEqual(legacyTarget("/top"), { path: "/discover", query: { sort: "rating" } })
    assert.deepEqual(legacyTarget("/trending"), { path: "/discover", query: { sort: "trending" } })
    assert.deepEqual(legacyTarget("/new"), { path: "/discover", query: { sort: "new" } })
    assert.deepEqual(legacyTarget("/ship"), { path: "/submit" })
    assert.deepEqual(legacyTarget("/for-developers"), { path: "/for-makers" })
    assert.deepEqual(legacyTarget("/activity"), { path: "/notifications" })
    assert.deepEqual(legacyTarget("/categories/ai"), { path: "/categories/ai-assistants" })
    assert.deepEqual(legacyTarget("/categories/fitness"), { path: "/categories/health-fitness" })
    for (const kept of ["/apps/metro-fit", "/categories/finance", "/pricing", "/partners", "/dashboard", "/", "/developers/novalabs"]) assert.equal(legacyTarget(kept), null, kept)
  })
})

describe("dictionaries", () => {
  const leaves = (o: unknown, path = ""): [string, string][] =>
    typeof o === "string" ? [[path, o]] : Array.isArray(o) ? o.flatMap((v, i) => leaves(v, `${path}[${i}]`)) : Object.entries(o as object).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k))
  const E = new Map(leaves(en)), D = new Map(leaves(de))

  it("German and English have the same keys and the same placeholders", () => {
    assert.deepEqual([...D.keys()].sort(), [...E.keys()].sort())
    for (const [key, text] of E) {
      const want = (text.match(/\{\w+\}/g) ?? []).sort()
      const got = (D.get(key)!.match(/\{\w+\}/g) ?? []).sort()
      assert.deepEqual(got, want, key)
    }
  })

  it("no text promises compliance, certification or safety", () => {
    const forbidden = [/gdpr[- ]compliant/i, /dsgvo[- ]konform/i, /ai act[- ]compliant/i, /\bcertified\b/i, /\bzertifiziert\b/i, /\bguaranteed\b/i, /\bgarantiert\b/i, /100 ?% (safe|secure|sicher)/i]
    for (const [key, text] of [...E, ...D]) for (const f of forbidden) assert.ok(!f.test(text), `${key}: "${text}"`)
  })

  it("sponsored content has its own word in each language", () => {
    assert.equal(en.card.sponsored, "Sponsored")
    assert.equal(de.card.sponsored, "Anzeige")
  })

  it("texts for the browser are split into what every page needs and what single pages need", () => {
    const both = (CLIENT_NAMESPACES as readonly string[]).filter((n) => (SCOPED_NAMESPACES as readonly string[]).includes(n))
    assert.deepEqual(both, [])
    const size = JSON.stringify(Object.fromEntries(CLIENT_NAMESPACES.map((n) => [n, de[n]]))).length
    assert.ok(size < 30_000, `the dictionary on every page is ${size} bytes`)
  })
})

describe("formatting", () => {
  it("fills placeholders and keeps unknown ones visible", () => {
    assert.equal(fmt("{a} of {b}", { a: 1, b: 2 }), "1 of 2")
    assert.equal(fmt("{a} {missing}", { a: "x" }), "x {missing}")
  })
  it("uses the plural form of the language", () => {
    assert.equal(plural("en", 1, en.card.ratings), "1 rating")
    assert.equal(plural("en", 2, en.card.ratings), "2 ratings")
    assert.equal(plural("de", 1, de.card.ratings), "1 Bewertung")
    assert.equal(plural("en", 0, en.card.ratings), "0 ratings")
  })
  it("formats prices per language and leaves whole amounts whole", () => {
    assert.equal(formatPrice("en", 4900, "EUR"), "€49")
    assert.match(formatPrice("de", 4950, "EUR"), /^49,50\s€$/)
  })
  it("picks the text of a language from a stored label and falls back to English", () => {
    assert.equal(pick({ en: "Finance", de: "Finanzen" }, "de"), "Finanzen")
    assert.equal(pick({ en: "Finance" }, "de"), "Finance")
    assert.equal(pick(null, "de", "fallback"), "fallback")
  })
  it("counts whole days and never goes negative", () => {
    const now = Date.parse("2026-09-29T12:00:00Z")
    assert.equal(daysSince("2026-09-29T00:00:00Z", now), 0)
    assert.equal(daysSince("2026-08-30T12:00:00Z", now), 30)
    assert.equal(daysSince("2026-10-05T00:00:00Z", now), 0)
    assert.equal(daysSince(null, now), null)
    assert.equal(daysSince("not a date", now), null)
  })
})

// ------------------------------------------------------------------ comparison
describe("comparison addresses", () => {
  it("have one form whatever order the apps were added in", () => {
    assert.equal(comparisonKey(["notion", "affine"]), "affine-vs-notion")
    assert.equal(comparisonKey(["affine", "notion"]), "affine-vs-notion")
    assert.equal(comparisonKey(["b", "a", "b", " A "]), "a-vs-b")
    assert.ok(isCanonicalKey("affine-vs-notion", ["notion", "affine"]))
    assert.ok(!isCanonicalKey("notion-vs-affine", ["notion", "affine"]))
  })
  it("hold at most four apps and drop anything that is not a slug", () => {
    assert.equal(MAX_COMPARE, 4)
    assert.deepEqual(comparisonSlugs(["e", "d", "c", "b", "a"]), ["a", "b", "c", "d"])
    assert.deepEqual(comparisonSlugs(["ok-1", "../etc/passwd", "<script>", "", "UPPER", "a--b", "-a"]), ["ok-1", "upper"])
  })
  it("read a key back, also when a slug contains the separator", () => {
    assert.deepEqual(parseComparisonKey("affine-vs-notion"), ["affine", "notion"])
    assert.deepEqual(parseComparisonKey("a-vs-b-vs-c", new Set(["a", "b-vs-c"])), ["a", "b-vs-c"])
    assert.deepEqual(parseComparisonKey("a-vs-b-vs-c", new Set(["a-vs-b", "c"])), ["a-vs-b", "c"])
    assert.deepEqual(parseComparisonKey("a-vs-unknown", new Set(["a"])), ["a", "unknown"])
  })
  it("finds all four apps of a full comparison, and every slug that contains -vs- itself", () => {
    const four = comparisonCandidates("a-vs-b-vs-c-vs-d")
    assert.deepEqual(four.slice(0, 4), ["a", "b", "c", "d"]) // the parts come first
    assert.equal(four.length, 10)
    assert.ok(four.includes("b-vs-c") && four.includes("a-vs-b-vs-c-vs-d"))
    const known = new Set(["a", "b", "c", "d"])
    assert.deepEqual(comparisonSlugs(parseComparisonKey("d-vs-c-vs-b-vs-a", known).filter((s) => known.has(s))), ["a", "b", "c", "d"])
  })
  it("looks at no more parts than two full comparisons, whatever the address says", () => {
    const long = Array.from({ length: 200 }, (_, i) => `app${i}`).join("-vs-")
    assert.equal(comparisonCandidates(long).length, 36)
    assert.equal(parseComparisonKey(long).length, MAX_COMPARE * 2)
    assert.deepEqual(comparisonCandidates("../etc-vs-<script>-vs-ok"), ["ok"])
  })
  it("only a comparison of two is offered to search engines", () => {
    assert.ok(isIndexableComparison(["a", "b"]))
    assert.ok(!isIndexableComparison(["a", "b", "c"]))
    assert.ok(!isIndexableComparison(["a"]))
  })
})

// ------------------------------------------------------------------ catalogue addresses
describe("catalogue filters in the address", () => {
  it("read multi-value filters and ignore anything that is not a plain value", () => {
    const s = parseCatalogParams({ q: "  invoice   software ", category: "finance,crm", fact: "dpa_available,open_source,DROP TABLE", country: "DE,de,XX1", lang: "de", eu: "1", rating: "4", page: "3", sort: "rating" })
    assert.equal(s.q, "invoice software")
    assert.deepEqual(s.filters.categories, ["finance", "crm"])
    assert.deepEqual(s.filters.facts, ["dpa_available", "open_source"])
    assert.deepEqual(s.filters.countries, ["DE"])
    assert.deepEqual(s.filters.languages, ["de"])
    assert.equal(s.filters.euCompany, true)
    assert.equal(s.filters.minRating, 4)
    assert.equal(s.page, 3)
    assert.equal(s.sort, "rating")
  })
  it("tolerate hostile and broken input", () => {
    const s = parseCatalogParams({ q: "x".repeat(500), page: "-5", sort: "'; drop table apps; --", rating: "99", fact: ["a".repeat(200), "ok_fact"], category: ["../..", "finance"] })
    assert.equal(s.q.length, 80)
    assert.equal(s.page, 1)
    assert.equal(s.sort, "relevance")
    assert.equal(s.filters.minRating, undefined)
    assert.deepEqual(s.filters.facts, ["ok_fact"])
    assert.deepEqual(s.filters.categories, ["finance"])
    assert.equal(parseCatalogParams({ page: "9999" }).page, 1)
  })
  it("keep v1 links working: verified meant ownership, pwa a manifest, top the default order, old category names", () => {
    const s = parseCatalogParams({ verified: "1", pwa: "1", sort: "top", category: "fitness" })
    assert.equal(s.filters.ownerVerified, true)
    assert.equal(s.filters.verifiedOnly, false)
    assert.deepEqual(s.filters.facts, ["pwa_manifest"])
    assert.equal(s.sort, "relevance")
    assert.deepEqual(s.filters.categories, ["health-fitness"])
  })
  it("equal states have equal addresses", () => {
    const a = catalogQuery(parseCatalogParams({ fact: "open_source,dpa_available", category: "finance", eu: "1" }))
    const b = catalogQuery(parseCatalogParams({ eu: "1", category: "finance", fact: "dpa_available,open_source" }))
    assert.equal(a, b)
    assert.equal(a, "category=finance&fact=dpa_available,open_source&eu=1")
    assert.equal(catalogHref({}), "/discover")
    assert.equal(catalogHref({ q: "a b", page: 2 }, "/categories/finance"), "/categories/finance?q=a+b&page=2")
  })
  it("a searched, filtered, sorted or later page is for people, not for search engines", () => {
    assert.ok(isIndexableCatalog(parseCatalogParams({})))
    for (const sp of [{ q: "x" }, { fact: "open_source" }, { page: "2" }, { sort: "new" }, { eu: "1" }, { evidence: "verified" }]) assert.ok(!isIndexableCatalog(parseCatalogParams(sp)), JSON.stringify(sp))
    assert.equal(activeFilterCount(parseCatalogParams({ fact: "a_b,c_d", eu: "1", rating: "4" }).filters), 4)
  })
})

describe("the same filters in the public API", () => {
  const state = (query: string) => parseCatalogParams(apiCatalogParams(new URLSearchParams(query)))

  it("reads lang as the language of the answer, never as a filter", () => {
    assert.deepEqual(state("q=ledger&fact=privacy_policy&lang=de").filters.languages, [])
    assert.equal(state("q=ledger&lang=de").q, "ledger")
  })
  it("filters by the languages of an app with language=", () => {
    assert.deepEqual(state("language=de,fr&lang=en").filters.languages, ["de", "fr"])
    assert.deepEqual(state("language=de&language=nl").filters.languages, ["de", "nl"])
  })
  it("takes repeated and comma separated values alike", () => {
    assert.deepEqual(state("fact=dpa_available&fact=sso,open_source").filters.facts, ["dpa_available", "sso", "open_source"])
  })
  it("ignores names it does not document, including the names of v1 and of object internals", () => {
    const s = state("verified=1&pwa=1&__proto__=x&constructor=y&toString=z&sort=rating&eu=1")
    assert.equal(s.filters.ownerVerified, false)
    assert.deepEqual(s.filters.facts, [])
    assert.equal(s.filters.euCompany, true)
    assert.equal(s.sort, "rating")
    assert.deepEqual(Object.keys(apiCatalogParams(new URLSearchParams("__proto__=x&a=b&q=1"))), ["q"])
  })
})

describe("collections", () => {
  it("are saved filters with addresses of their own", () => {
    assert.ok(isCollection("pwa") && isCollection("eu-companies") && !isCollection("metro-fit") && !isCollection("__proto__"))
    const facets = { facts: { pwa_manifest: 7, open_source: 2 }, euCompany: 5 } as unknown as FacetCounts
    assert.equal(collectionCount("pwa", facets), 7)
    assert.equal(collectionCount("eu-companies", facets), 5)
    assert.equal(collectionCount("mcp", facets), 0)
    for (const slug of COLLECTION_SLUGS) assert.ok(en.collections.items[slug].title && de.collections.items[slug].title, slug)
    assert.equal(Object.keys(COLLECTIONS).length, Object.keys(en.collections.items).length)
  })
})

// ------------------------------------------------------------------ trust display
describe("trust signals", () => {
  const registry = [attr("eu_company", { dimension: "company" }), attr("dpa_available"), attr("open_source", { dimension: "technical" }), attr("company_country", { valueType: "country", dimension: "company" }), attr("sso", { isCardSignal: false })]

  it("a card shows documented positives only: never a no, never an unknown", () => {
    const signals = pickCardSignals({
      eu_company: summary("yes", "vendor"), dpa_available: summary("no", "verified"), open_source: summary("unknown", "none"),
      company_country: summary("yes", "vendor"), sso: summary("yes", "verified"),
    }, registry)
    assert.deepEqual(signals.map((s) => [s.key, s.origin]), [["eu_company", "vendor"]])
  })
  it("keeps verified and vendor-stated apart and caps the number of signals", () => {
    const many = Object.fromEntries(["a", "b", "c", "d", "e", "f"].map((k) => [k, summary("yes", k < "d" ? "verified" : "vendor")]))
    const signals = pickCardSignals(many, ["a", "b", "c", "d", "e", "f"].map((k) => attr(k)), 4)
    assert.equal(signals.length, 4)
    assert.deepEqual(signals.map((s) => s.origin), ["verified", "verified", "verified", "vendor"])
  })
  it("answers are spelled out, so a yes cannot be read as its opposite", () => {
    const a = attr("no_training_on_customer_data", { label: { en: "Training on customer data" }, positiveLabel: { en: "No training on customer data", de: "Kein Training mit Kundendaten" }, negativeLabel: { en: "Customer data may be used for training" } })
    assert.equal(factLabel(a, "yes", "en"), "No training on customer data")
    assert.equal(factLabel(a, "yes", "de"), "Kein Training mit Kundendaten")
    assert.equal(factLabel(a, "no", "en"), "Customer data may be used for training")
    assert.equal(factLabel(a, "no", "de"), "Customer data may be used for training", "falls back to English, never to the positive label")
    assert.equal(factLabel(a, "unknown", "en"), "Training on customer data")
  })
  it("counts verified, stated and unknown separately per dimension", () => {
    const fact = (key: string, origin: AppFact["origin"]): AppFact => ({ key, verifiedState: origin === "verified" ? "yes" : "unknown", verifiedValue: null, verifiedSourceType: null, verifiedSourceUrl: null, verifiedAt: null, vendorState: origin === "vendor" ? "yes" : "unknown", vendorValue: null, vendorSourceUrl: null, vendorStatedAt: null, effectiveState: origin === "none" ? "unknown" : "yes", origin, lastAttemptAt: null, lastAttemptOutcome: null })
    const s = summarizeDimensions([fact("eu_company", "vendor"), fact("dpa_available", "verified")], registry)
    assert.deepEqual(s.find((d) => d.dimension === "company"), { dimension: "company", expected: 2, verified: 0, vendor: 1, unknown: 1 })
    assert.deepEqual(s.find((d) => d.dimension === "data"), { dimension: "data", expected: 2, verified: 1, vendor: 0, unknown: 1 })
  })
  it("says how fresh a verification is", () => {
    const now = Date.parse("2026-09-29T12:00:00Z")
    assert.equal(freshness("2026-09-29T08:00:00Z", 90, now), "today")
    assert.equal(freshness("2026-08-01T00:00:00Z", 90, now), "fresh")
    assert.equal(freshness("2026-05-01T00:00:00Z", 90, now), "aging")
    assert.equal(freshness("2025-01-01T00:00:00Z", 90, now), "stale")
    assert.equal(freshness(null, 90, now), "never")
    assert.ok(isRecentlyVerified("2026-09-05T00:00:00Z", now) && !isRecentlyVerified("2026-08-01T00:00:00Z", now) && !isRecentlyVerified(null, now))
  })
  it("states a price only when one was stated", () => {
    assert.deepEqual(priceSummary({ pricingModel: "unknown", hasFreePlan: null, startingPriceCents: null, priceCurrency: null }), { model: "unknown", from: null })
    assert.deepEqual(priceSummary({ pricingModel: "unknown", hasFreePlan: true, startingPriceCents: null, priceCurrency: null }), { model: "freemium", from: null })
    assert.deepEqual(priceSummary({ pricingModel: "subscription", hasFreePlan: false, startingPriceCents: 900, priceCurrency: "EUR" }), { model: "subscription", from: { cents: 900, currency: "EUR" } })
    assert.deepEqual(priceSummary({ pricingModel: "subscription", hasFreePlan: false, startingPriceCents: 900, priceCurrency: null }).from, null)
  })
  it("facts that follow from something else are not stated by hand", () => {
    for (const key of NOT_STATEABLE) assert.ok(!(STATEABLE_CAPABILITIES as readonly string[]).includes(key), key)
    assert.ok((REQUESTABLE_FACTS as readonly string[]).includes("eu_company"))
  })
})

describe("vendor texts", () => {
  it("uses a German text where there is one and says when the original is shown", () => {
    const a = app("x", { taglineDe: "Rechnungen schreiben", descriptionDe: "Eine Beschreibung." })
    assert.deepEqual(localizedText(a, "de"), { tagline: "Rechnungen schreiben", description: "Eine Beschreibung.", original: false, lang: "de" })
    assert.deepEqual(localizedText(app("x"), "de"), { tagline: "A tagline", description: "A description", original: true, lang: "en" })
    assert.equal(localizedText(app("x"), "en").original, false)
    assert.equal(localizedText(app("x", { contentLocale: "de", tagline: "Hallo", description: "Text" }), "de").original, false)
    assert.equal(localizedText(app("x", { contentLocale: "de", tagline: "Hallo", description: "Text" }), "en").original, true)
  })
  it("cuts a description at a word for search engines", () => {
    assert.equal(excerpt("Short."), "Short.")
    const long = excerpt("word ".repeat(100), 60)
    assert.ok(long.length <= 60 && long.endsWith("…") && !long.includes("  "))
    assert.equal(excerpt("line\n\nbreaks   and   spaces"), "line breaks and spaces")
  })
})

// ------------------------------------------------------------------ matching
describe("request matching", () => {
  const verified = app("verified", { facts: { dpa_available: summary("yes", "verified"), eu_company: summary("yes", "verified") }, evidenceScore: 80 })
  const stated = app("stated", { facts: { dpa_available: summary("yes", "vendor"), eu_company: summary("yes", "vendor") }, evidenceScore: 40 })
  const silent = app("silent", { evidenceScore: 90 })
  const refuses = app("refuses", { facts: { dpa_available: summary("no", "verified"), eu_company: summary("yes", "verified") }, evidenceScore: 95 })
  const elsewhere = app("elsewhere", { categorySlugs: ["crm"], facts: { dpa_available: summary("yes", "verified") } })
  const demo = app("demo", { isDemo: true, facts: { dpa_available: summary("yes", "verified"), eu_company: summary("yes", "verified") } })
  const all = [silent, refuses, stated, elsewhere, verified, demo]
  const wanted = criteria({ categorySlugs: ["finance"], requiredFacts: ["dpa_available", "eu_company"] })

  it("ranks what is verified above what is stated, and leaves out what documents nothing", () => {
    assert.deepEqual(matchRequest(all, wanted).map((m) => m.slug), ["verified", "stated"])
  })
  it("unknown is not no: a product without an answer is not ruled out, a documented no is", () => {
    const silentResult = evaluate(silent, wanted)
    assert.ok(silentResult, "a product that says nothing is still evaluated")
    assert.deepEqual(silentResult!.requirements.filter((r) => r.kind === "fact").map((r) => r.status), ["unverified", "unverified"])
    assert.equal(evaluate(refuses, wanted), null, "a verified no on a required fact rules the product out")
    const one = matchRequest([silent, app("half", { facts: { dpa_available: summary("yes", "vendor") } })], wanted)
    assert.deepEqual(one.map((m) => [m.slug, m.met, m.total]), [["half", 1, 2]])
  })
  it("stays inside the market the request names", () => {
    assert.equal(evaluate(elsewhere, wanted), null)
    assert.ok(evaluate(elsewhere, criteria({ requiredFacts: ["dpa_available"] })))
  })
  it("never lists fabricated sample products, except where sample data is switched on", () => {
    assert.ok(!matchRequest(all, wanted).some((m) => m.slug === "demo"))
    assert.ok(matchRequest(all, wanted, { includeDemo: true }).some((m) => m.slug === "demo"))
  })
  it("is deterministic: the same input gives the same list, whatever the order of the catalogue", () => {
    const first = matchRequest(all, wanted)
    for (let i = 0; i < 5; i++) assert.deepEqual(matchRequest([...all].reverse().sort(() => (i % 2 ? 1 : -1)), wanted), first)
    const twins = [app("b-twin", { facts: { dpa_available: summary("yes", "verified") } }), app("a-twin", { facts: { dpa_available: summary("yes", "verified") } })]
    assert.deepEqual(matchRequest(twins, criteria({ requiredFacts: ["dpa_available"] })).map((m) => m.slug), ["a-twin", "b-twin"])
  })
  it("returns at most five", () => {
    const many = Array.from({ length: 12 }, (_, i) => app(`p${String(i).padStart(2, "0")}`, { facts: { dpa_available: summary("yes", "verified") } }))
    assert.equal(matchRequest(many, criteria({ requiredFacts: ["dpa_available"] })).length, 5)
    assert.equal(matchRequest(many, criteria({ requiredFacts: ["dpa_available"] }), { max: 50 }).length, 5)
    assert.equal(matchRequest(many, criteria({ requiredFacts: ["dpa_available"] }), { max: 3 }).length, 3)
  })
  it("compares a budget only with a stated price in the same currency", () => {
    const budget = criteria({ budgetMaxCents: 2000 })
    const status = (a: CatalogApp) => evaluate(a, budget)!.requirements.find((r) => r.kind === "budget")!.status
    assert.equal(status(app("cheap", { startingPriceCents: 900, priceCurrency: "EUR" })), "met_vendor")
    assert.equal(status(app("dear", { startingPriceCents: 9900, priceCurrency: "EUR" })), "not_met")
    assert.equal(status(app("dollars", { startingPriceCents: 900, priceCurrency: "USD" })), "unverified")
    assert.equal(status(app("silent")), "unverified")
    assert.equal(status(app("free", { hasFreePlan: true })), "met_vendor")
  })
  it("German can be a verified fact or a listed language", () => {
    const lang = criteria({ languages: ["de"] })
    const status = (a: CatalogApp) => evaluate(a, lang)!.requirements[0].status
    assert.equal(status(app("v", { facts: { german_available: summary("yes", "verified") } })), "met")
    assert.equal(status(app("l", { languages: ["de"] })), "met_vendor")
    assert.equal(status(app("n")), "unverified")
  })
  it("finds contact details in free text, and leaves ordinary text alone", () => {
    for (const text of ["write to anna@firma.example", "anna (at) firma.de", "ruf an: +49 30 1234567", "0049 170 1234567", "Tel. 030 12345678"]) assert.ok(containsContactDetails(text), text)
    for (const text of ["We write about 40 invoices a month for 20 people", "Budget up to 2000 EUR per year, ISO 27001", "Version 2.0.1 from 2026", "A team of 12, in 3 offices"]) assert.ok(!containsContactDetails(text), text)
  })
})

describe("keys that come from an address", () => {
  it("are looked up among own keys only: names of the language's built-in properties are ordinary text", () => {
    for (const word of ["constructor", "toString", "hasOwnProperty", "valueOf"]) {
      assert.equal(legacyTarget(`/categories/${word}`), null, word)
      assert.ok(!isCollection(word), word)
    }
    assert.deepEqual(parseCatalogParams({ category: "constructor" }).filters.categories, ["constructor"])
    assert.deepEqual(parseCatalogParams({ category: "toString" }).filters.categories, [], "not a slug at all")
    assert.equal(catalogHref(parseCatalogParams({ category: "constructor", platform: "constructor" })), "/discover?category=constructor&platform=constructor")
  })
})
