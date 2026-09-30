import type { NextRequest } from "next/server"
import { getCategories } from "@/lib/data/catalog"
import { siteUrl } from "@/lib/env"
import { API_VERSION, json, limited, localeOf, preflight } from "@/lib/v2/api"

export const OPTIONS = preflight

/** GET /api/v1/categories?lang= */
export async function GET(req: NextRequest) {
  const blocked = await limited()
  if (blocked) return blocked
  const locale = localeOf(req.nextUrl.searchParams.get("lang"))
  const categories = await getCategories()
  return json({
    apiVersion: API_VERSION, lang: locale,
    data: categories.map((c) => ({ slug: c.slug, name: c.name[locale] ?? c.name.en, description: c.description[locale] ?? c.description.en ?? null, listings: c.count, url: `${siteUrl}/${locale}/categories/${c.slug}` })),
  }, { cache: "public, s-maxage=3600, stale-while-revalidate=86400" })
}
