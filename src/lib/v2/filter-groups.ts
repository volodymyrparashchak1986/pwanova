import type { Locale } from "@/i18n/config"
import type { Dictionary } from "@/i18n/dictionaries"
import { countryName, languageName, pick } from "@/i18n/format"
import type { FilterGroup, FilterOption } from "@/components/catalog/filter-panel"
import type { CatalogFilters, CategoryInfo, FacetCounts, FactAttribute } from "./types"
import { own } from "@/lib/utils"
import { factLabel } from "./trust"

const byCount = (a: FilterOption, b: FilterOption) => b.count - a.count || a.label.localeCompare(b.label)

/**
 * The filters offered for a catalogue. A value is only offered when at least one public listing
 * has it, so the interface never suggests data that does not exist yet.
 */
export function buildFilterGroups(input: {
  t: Dictionary; locale: Locale; facets: FacetCounts; categories: CategoryInfo[]; registry: FactAttribute[]
  useCases: { slug: string; name: Record<string, string> }[]; integrations: { slug: string; name: string }[]
  filters: CatalogFilters; hideCategory?: boolean
}): FilterGroup[] {
  const { t, locale, facets, registry, filters } = input
  const factCounts = filters.verifiedOnly ? facets.factsVerified : facets.facts
  const facts = (dimensions: string[]) => registry
    .filter((a) => a.isFilterable && a.valueType !== "country" && dimensions.includes(a.dimension) && !["eu_company", "free_plan"].includes(a.key))
    .map((a) => ({ value: a.key, label: factLabel(a, "yes", locale), count: factCounts[a.key] ?? 0 }))
    .filter((o) => o.count > 0 || filters.facts?.includes(o.value))
  const from = (bag: Record<string, number>, label: (key: string) => string, selected?: string[]): FilterOption[] =>
    Object.entries(bag).map(([value, count]) => ({ value, label: label(value), count }))
      .concat((selected ?? []).filter((s) => !(s in bag)).map((value) => ({ value, label: label(value), count: 0 })))
      .sort(byCount)
  const flags = (items: [string, string, number, boolean | undefined][]): FilterOption[] =>
    items.filter(([, , count, on]) => count > 0 || on).map(([value, label, count]) => ({ value, label, count }))

  const groups: FilterGroup[] = []
  if (!input.hideCategory) {
    groups.push({
      id: "category", title: t.filters.groups.category, kind: "multi", param: "category",
      options: input.categories.filter((c) => c.count > 0 || filters.categories?.includes(c.slug)).map((c) => ({ value: c.slug, label: pick(c.name, locale), count: c.count })).sort(byCount),
    })
  }
  groups.push(
    {
      id: "verification", title: t.filters.groups.verification, kind: "flag", param: "", help: t.filters.verifiedOnlyHelp,
      options: [
        { value: "evidence", label: t.filters.verifiedOnly, count: facets.withVerifiedFacts, hint: "verified" },
        ...flags([["owner", t.filters.ownerVerified, facets.ownerVerified, filters.ownerVerified], ["fresh", t.filters.checkedRecently, facets.checkedRecently, Boolean(filters.checkedWithinDays)]]),
      ].filter((o) => o.count > 0 || (o.value === "evidence" && filters.verifiedOnly)),
    },
    {
      id: "company", title: t.filters.groups.company, kind: "flag", param: "",
      options: flags([["eu", t.filters.euCompany, facets.euCompany, filters.euCompany]]),
    },
    { id: "country", title: t.filters.country, kind: "multi", param: "country", options: from(facets.countries, (c) => countryName(locale, c), filters.countries) },
    { id: "data", title: t.filters.groups.data, kind: "multi", param: "fact", options: facts(["data"]) },
    { id: "capability", title: t.filters.groups.capability, kind: "multi", param: "fact", options: facts(["technical", "product"]) },
    { id: "ai", title: t.filters.groups.ai, kind: "multi", param: "fact", options: facts(["ai"]) },
    {
      id: "pricing", title: t.filters.groups.pricing, kind: "multi", param: "price",
      options: from(facets.pricingModels, (m) => own(t.card.pricing, m) ?? m, filters.pricingModels),
    },
    { id: "plan", title: t.filters.freePlan, kind: "flag", param: "", options: flags([["free", t.filters.freePlan, facets.freePlan, filters.freePlan], ["trial", t.filters.freeTrial, facets.freeTrial, filters.freeTrial]]) },
    { id: "platform", title: t.filters.groups.platform, kind: "multi", param: "platform", options: from(facets.platforms, (p) => own(t.filters.platforms, p) ?? p, filters.platforms) },
    { id: "language", title: t.filters.groups.language, kind: "multi", param: "lang", options: from(facets.languages, (l) => languageName(locale, l), filters.languages) },
    {
      id: "use", title: t.filters.groups.useCase, kind: "multi", param: "use",
      options: from(facets.useCases, (u) => pick(input.useCases.find((x) => x.slug === u)?.name, locale, u), filters.useCases),
    },
    {
      id: "integration", title: t.filters.groups.integration, kind: "multi", param: "integration",
      options: from(facets.integrations, (i) => input.integrations.find((x) => x.slug === i)?.name ?? i, filters.integrations),
    },
  )
  return groups.filter((g) => g.options.length > 0)
}

export interface ActiveFilter { key: string; label: string; remove: CatalogFilters }

/** Every selected filter as a chip, each with the filter set that results from removing it. */
export function activeFilters(input: { t: Dictionary; locale: Locale; filters: CatalogFilters; categories: CategoryInfo[]; registry: FactAttribute[]; useCases: { slug: string; name: Record<string, string> }[]; integrations: { slug: string; name: string }[] }): ActiveFilter[] {
  const { t, locale, filters: f } = input
  const out: ActiveFilter[] = []
  const without = (key: keyof CatalogFilters, value: string) => ({ ...f, [key]: ((f[key] as string[] | undefined) ?? []).filter((v) => v !== value) })
  const each = (key: keyof CatalogFilters, label: (v: string) => string) => {
    for (const v of (f[key] as string[] | undefined) ?? []) out.push({ key: `${String(key)}:${v}`, label: label(v), remove: without(key, v) })
  }
  each("categories", (v) => pick(input.categories.find((c) => c.slug === v)?.name, locale, v))
  each("facts", (v) => { const a = input.registry.find((x) => x.key === v); return a ? factLabel(a, "yes", locale) : v })
  each("countries", (v) => countryName(locale, v))
  each("pricingModels", (v) => own(t.card.pricing, v) ?? v)
  each("platforms", (v) => own(t.filters.platforms, v) ?? v)
  each("languages", (v) => languageName(locale, v))
  each("useCases", (v) => pick(input.useCases.find((x) => x.slug === v)?.name, locale, v))
  each("integrations", (v) => input.integrations.find((x) => x.slug === v)?.name ?? v)
  each("hosts", (v) => `${t.filters.host}: ${v}`)
  const flag = (on: unknown, key: keyof CatalogFilters, label: string) => { if (on) out.push({ key: String(key), label, remove: { ...f, [key]: undefined } }) }
  flag(f.verifiedOnly, "verifiedOnly", t.filters.verifiedOnly)
  flag(f.euCompany, "euCompany", t.filters.euCompany)
  flag(f.freePlan, "freePlan", t.filters.freePlan)
  flag(f.freeTrial, "freeTrial", t.filters.freeTrial)
  flag(f.ownerVerified, "ownerVerified", t.filters.ownerVerified)
  flag(f.checkedWithinDays, "checkedWithinDays", t.filters.checkedRecently)
  flag(f.minRating, "minRating", `${t.filters.minRating}: ${f.minRating}`)
  return out
}
