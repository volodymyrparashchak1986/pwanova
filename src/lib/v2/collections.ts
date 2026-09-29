import type { CatalogFilters, FacetCounts } from "./types"

/**
 * Collections are saved filters with a name. They live under /collections/<slug>, not under /apps/<slug>,
 * so a product can never collide with one of them. A collection is indexed once it has enough listings.
 */
export const COLLECTIONS = {
  pwa: { filters: { facts: ["pwa_manifest"] } },
  "open-source": { filters: { facts: ["open_source"] } },
  "self-hosted": { filters: { facts: ["self_hosted"] } },
  mcp: { filters: { facts: ["mcp_available"] } },
  api: { filters: { facts: ["api_available"] } },
  "eu-hosting": { filters: { facts: ["eu_hosting_available"] } },
  "eu-companies": { filters: { euCompany: true } },
  dpa: { filters: { facts: ["dpa_available"] } },
  german: { filters: { facts: ["german_available"] } },
  "no-training": { filters: { facts: ["no_training_on_customer_data"] } },
} as const satisfies Record<string, { filters: CatalogFilters }>

export type CollectionSlug = keyof typeof COLLECTIONS
export const COLLECTION_SLUGS = Object.keys(COLLECTIONS) as CollectionSlug[]
/** Own keys only: "constructor" or "__proto__" in the address are not collections. */
export const isCollection = (slug: string): slug is CollectionSlug => Object.hasOwn(COLLECTIONS, slug)
/** Below this number of listings a collection is a thin page: visible to people, not offered to search engines. */
export const MIN_INDEXABLE_LISTINGS = 3

/** How many public listings a collection has, from the same counts the filters use. */
export function collectionCount(slug: CollectionSlug, facets: FacetCounts): number {
  const f = COLLECTIONS[slug].filters
  return "euCompany" in f ? facets.euCompany : facets.facts[f.facts[0]] ?? 0
}
