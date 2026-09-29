import type { NextRequest } from "next/server"
import { getFactRegistry } from "@/lib/data/catalog"
import { API_VERSION, factDefinition, json, limited, localeOf, preflight } from "@/lib/v2/api"

export const OPTIONS = preflight

/** GET /api/v1/facts?lang= — the registry of facts: what each key means and whether PWANova checks it automatically. */
export async function GET(req: NextRequest) {
  const blocked = await limited()
  if (blocked) return blocked
  const locale = localeOf(req.nextUrl.searchParams.get("lang"))
  const registry = await getFactRegistry()
  return json({
    apiVersion: API_VERSION, lang: locale,
    states: { yes: "documented", no: "documented as not the case", unknown: "nobody has checked or stated it; never to be read as no" },
    origins: { verified: "checked or reviewed by PWANova", vendor: "stated by the verified owner, not confirmed by PWANova", none: "no answer" },
    data: registry.map((a) => factDefinition(a, locale)),
  }, { cache: "public, s-maxage=3600, stale-while-revalidate=86400" })
}
