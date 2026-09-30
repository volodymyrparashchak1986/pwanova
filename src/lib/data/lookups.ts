import { getCategories, getFactRegistry, getIntegrationCatalog, getUseCases } from "./catalog"
import type { Lookups } from "@/components/requests/request-parts"

/** Names for slugs and keys, fetched once per request (every getter is cached). */
export async function getLookups(): Promise<Lookups> {
  const [registry, categories, useCases, integrations] = await Promise.all([getFactRegistry(), getCategories(), getUseCases(), getIntegrationCatalog()])
  return { registry, categories, useCases, integrations }
}
