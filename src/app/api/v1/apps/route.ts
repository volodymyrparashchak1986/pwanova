import type { NextRequest } from "next/server"
import { searchCatalog } from "@/lib/data/catalog"
import { API_VERSION, apiError, appSummary, json, limited, localeOf, preflight } from "@/lib/v2/api"
import { apiCatalogParams, parseCatalogParams } from "@/lib/v2/params"

export const OPTIONS = preflight

/**
 * GET /api/v1/apps?q=&category=&fact=&language=&eu=1&sort=&page=&pageSize=&lang= — the same search and
 * filters as the discover page. `lang` is the language of the answer, `language` filters by the
 * languages an app is available in.
 */
export async function GET(req: NextRequest) {
  const blocked = await limited()
  if (blocked) return blocked
  const sp = req.nextUrl.searchParams
  const state = parseCatalogParams(apiCatalogParams(sp))
  const pageSize = Math.min(48, Math.max(1, Math.floor(Number(sp.get("pageSize"))) || 24))
  if (state.page > 100) return apiError(400, "page is limited to 100.")
  const locale = localeOf(sp.get("lang"))
  const result = await searchCatalog({ q: state.q, filters: state.filters, sort: state.sort, page: state.page, pageSize })
  return json({
    apiVersion: API_VERSION, lang: locale, page: result.page, pageSize: result.pageSize, total: result.total,
    data: result.apps.map((a) => appSummary(a, locale)),
  })
}
