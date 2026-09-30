import type { NextRequest } from "next/server"
import { getCatalogBySlugs } from "@/lib/data/catalog"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured, showDemoData } from "@/lib/env"
import { API_VERSION, apiError, appSummary, json, limited, localeOf, preflight } from "@/lib/v2/api"

export const OPTIONS = preflight

/** GET /api/v1/apps/by-domain?domain=example.com — for launch boards that know the domain, not the slug. */
export async function GET(req: NextRequest) {
  const blocked = await limited()
  if (blocked) return blocked
  const raw = req.nextUrl.searchParams.get("domain")?.trim().toLowerCase() ?? ""
  let domain = ""
  try { domain = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.replace(/^www\./, "") } catch { /* invalid */ }
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return apiError(400, "Provide a valid ?domain=example.com")
  if (!isSupabaseConfigured) return apiError(404, "Not found, or not public.")
  const sb = await createClient()
  let q = sb.from("catalog_apps").select("slug").eq("domain", domain)
  if (!showDemoData) q = q.eq("is_demo", false)
  const { data } = await q.limit(5)
  const slugs = (data ?? []).flatMap((r) => (r.slug ? [r.slug] : []))
  if (!slugs.length) return apiError(404, "Not found, or not public.")
  const locale = localeOf(req.nextUrl.searchParams.get("lang"))
  const apps = await getCatalogBySlugs(slugs)
  return json({ apiVersion: API_VERSION, lang: locale, domain, data: apps.map((a) => appSummary(a, locale)) })
}
