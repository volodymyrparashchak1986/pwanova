import { legacyCategory } from "@/i18n/config"
import type { CatalogFilters, CatalogSort } from "./types"

export type SearchParams = Record<string, string | string[] | undefined>
export interface CatalogState { q: string; filters: CatalogFilters; sort: CatalogSort; page: number }

export const SORTS: CatalogSort[] = ["relevance", "recently_verified", "rating", "trending", "new", "name"]
const TOKEN = /^[a-z0-9][a-z0-9_-]{0,59}$/
const COUNTRY = /^[A-Z]{2}$/

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? ""
/** "a,b" or repeated parameters → clean, de-duplicated tokens. Anything that is not a plain slug is dropped. */
function list(v: string | string[] | undefined, test: RegExp = TOKEN, max = 12): string[] {
  const raw = (Array.isArray(v) ? v : [v ?? ""]).flatMap((x) => x.split(","))
  return [...new Set(raw.map((x) => x.trim()).filter((x) => test.test(x)))].slice(0, max)
}
const flag = (v: string | string[] | undefined) => one(v) === "1" || one(v) === "true"

/**
 * The catalogue state of a URL. Multi-value filters are comma separated (?fact=dpa_available,open_source).
 * v1 parameters keep working: ?verified=1 meant "ownership verified", ?pwa=1 a detected manifest,
 * ?sort=top the default order, ?category= one of the old category slugs.
 */
export function parseCatalogParams(sp: SearchParams): CatalogState {
  const sortRaw = one(sp.sort)
  const sort: CatalogSort = sortRaw === "top" ? "relevance" : (SORTS as string[]).includes(sortRaw) ? (sortRaw as CatalogSort) : "relevance"
  const rating = Number(one(sp.rating))
  const page = Math.floor(Number(one(sp.page)))
  const facts = list(sp.fact, /^[a-z][a-z0-9_]{1,60}$/)
  if (flag(sp.pwa) && !facts.includes("pwa_manifest")) facts.push("pwa_manifest")
  const filters: CatalogFilters = {
    categories: list(sp.category).map((c) => legacyCategory(c) ?? c),
    useCases: list(sp.use),
    integrations: list(sp.integration),
    languages: list(sp.lang, /^[a-z]{2,3}$/),
    platforms: list(sp.platform, /^[a-z_]{2,20}$/),
    pricingModels: list(sp.price, /^[a-z_]{2,20}$/),
    countries: list(sp.country, COUNTRY),
    hosts: list(sp.host),
    facts,
    verifiedOnly: one(sp.evidence) === "verified",
    euCompany: flag(sp.eu),
    freePlan: flag(sp.free),
    freeTrial: flag(sp.trial),
    ownerVerified: flag(sp.owner) || flag(sp.verified),
    checkedWithinDays: flag(sp.fresh) ? 30 : undefined,
    minRating: rating >= 1 && rating <= 5 ? Math.round(rating * 2) / 2 : undefined,
  }
  return { q: one(sp.q).replace(/\s+/g, " ").slice(0, 80), filters, sort, page: page >= 1 && page <= 500 ? page : 1 }
}

const API_PARAMS = ["q", "category", "use", "integration", "platform", "price", "country", "host", "fact", "evidence", "eu", "free", "trial", "owner", "fresh", "rating", "sort", "page"] as const
/**
 * The query of a public API request as catalogue parameters. Only the documented names are read. On
 * every API endpoint `lang` is the language of the answer, so the filter "available in" is `language`
 * there (on the discover page the language of the page is in the path, and the filter is `lang`).
 */
export function apiCatalogParams(query: URLSearchParams): SearchParams {
  const out: SearchParams = {}
  for (const key of API_PARAMS) if (query.has(key)) out[key] = query.getAll(key)
  if (query.has("language")) out.lang = query.getAll("language")
  return out
}

/** The same state as a query string, in one fixed order, so equal states have equal URLs. */
export function catalogQuery(state: Partial<CatalogState> & { filters?: CatalogFilters }): string {
  const f = state.filters ?? {}
  const p = new URLSearchParams()
  const set = (key: string, values?: string[]) => { if (values?.length) p.set(key, [...values].sort().join(",")) }
  if (state.q) p.set("q", state.q)
  set("category", f.categories); set("use", f.useCases); set("price", f.pricingModels); set("platform", f.platforms)
  set("fact", f.facts); set("lang", f.languages); set("country", f.countries); set("integration", f.integrations); set("host", f.hosts)
  if (f.verifiedOnly) p.set("evidence", "verified")
  if (f.euCompany) p.set("eu", "1")
  if (f.freePlan) p.set("free", "1")
  if (f.freeTrial) p.set("trial", "1")
  if (f.ownerVerified) p.set("owner", "1")
  if (f.checkedWithinDays) p.set("fresh", "1")
  if (f.minRating) p.set("rating", String(f.minRating))
  if (state.sort && state.sort !== "relevance") p.set("sort", state.sort)
  if (state.page && state.page > 1) p.set("page", String(state.page))
  // commas are readable and safe in a query string
  return p.toString().replace(/%2C/g, ",")
}

export function catalogHref(state: Partial<CatalogState>, base = "/discover"): string {
  const qs = catalogQuery(state)
  return qs ? `${base}?${qs}` : base
}

export function activeFilterCount(f: CatalogFilters): number {
  const lists = [f.categories, f.useCases, f.integrations, f.languages, f.platforms, f.pricingModels, f.countries, f.hosts, f.facts]
  const flags = [f.verifiedOnly, f.euCompany, f.freePlan, f.freeTrial, f.ownerVerified, Boolean(f.checkedWithinDays), Boolean(f.minRating)]
  return lists.reduce((n, l) => n + (l?.length ?? 0), 0) + flags.filter(Boolean).length
}

/** A page of results that is filtered, searched or paginated is useful to a person but thin for a search engine. */
export const isIndexableCatalog = (state: CatalogState) => !state.q && state.page === 1 && state.sort === "relevance" && activeFilterCount(state.filters) === 0
