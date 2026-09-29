import type { MetadataRoute } from "next"
import { operatorComplete } from "@/content/legal"
import { LOCALES } from "@/i18n/config"
import { createClient } from "@/lib/supabase/server"
import { getCategories, getFacetCounts, getLaunches, getPublicSettings } from "@/lib/data/catalog"
import { isSupabaseConfigured, siteUrl } from "@/lib/env"
import { collectionCount, COLLECTION_SLUGS, MIN_INDEXABLE_LISTINGS } from "@/lib/v2/collections"

export const dynamic = "force-dynamic"

type Entry = MetadataRoute.Sitemap[number]

/** One entry per language, each naming its siblings, so search engines serve the right edition. */
function localized(path: string, lastModified?: Date, priority?: number): Entry[] {
  const clean = path === "/" ? "" : path
  const languages = Object.fromEntries(LOCALES.map((l) => [l, `${siteUrl}/${l}${clean}`]))
  return LOCALES.map((l) => ({ url: `${siteUrl}/${l}${clean}`, lastModified, priority, alternates: { languages } }))
}

/**
 * Only pages with content of their own: public, real listings; categories and collections that have
 * listings; alternatives pages with at least two products. Fabricated sample listings never appear.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const [settings, categories, facets] = await Promise.all([getPublicSettings(), getCategories(), getFacetCounts()])
  const staticPages = ["/", "/discover", "/categories", "/collections", "/for-makers", "/pricing", "/partners", "/verification-methodology", "/how-ranking-works", "/sponsorship", "/review-rules", "/legal/terms"]
  if (settings.features.compare) staticPages.push("/compare")
  if (settings.features.launches) staticPages.push("/launches")
  if (settings.features.requests) staticPages.push("/requests")
  if (operatorComplete(settings.operator)) staticPages.push("/legal/imprint", "/legal/privacy")

  const out: Entry[] = staticPages.flatMap((p) => localized(p, now, p === "/" ? 1 : 0.6))
  out.push(...categories.filter((c) => c.count > 0).flatMap((c) => localized(`/categories/${c.slug}`, now, 0.7)))
  out.push(...COLLECTION_SLUGS.filter((s) => collectionCount(s, facets) >= MIN_INDEXABLE_LISTINGS).flatMap((s) => localized(`/collections/${s}`, now, 0.6)))
  if (!isSupabaseConfigured) return out

  const sb = await createClient()
  const [{ data: apps }, { data: alternatives }, launches] = await Promise.all([
    sb.from("catalog_apps").select("id, slug, updated_at, developer_username").eq("is_demo", false).order("updated_at", { ascending: false }).limit(5000),
    sb.from("app_alternatives").select("alternative_to_slug, app_id").neq("source_type", "user_submitted").limit(5000),
    settings.features.launches ? Promise.all([getLaunches({ current: true, limit: 100 }), getLaunches({ current: false, limit: 200 })]).then((l) => l.flat()) : Promise.resolve([]),
  ])
  const listed = (apps ?? []).filter((a) => a.slug)
  const publicIds = new Set(listed.map((a) => a.id))
  out.push(...listed.flatMap((a) => localized(`/apps/${a.slug}`, a.updated_at ? new Date(a.updated_at) : now, 0.8)))
  out.push(...[...new Set(listed.map((a) => a.developer_username).filter((u): u is string => Boolean(u)))].flatMap((u) => localized(`/developers/${u}`)))

  const perTarget = new Map<string, number>()
  for (const a of alternatives ?? []) if (publicIds.has(a.app_id)) perTarget.set(a.alternative_to_slug, (perTarget.get(a.alternative_to_slug) ?? 0) + 1)
  out.push(...[...perTarget].filter(([, n]) => n >= 2).flatMap(([slug]) => localized(`/alternatives/${slug}`, now, 0.5)))
  out.push(...launches.filter((l) => !l.app.isDemo).flatMap((l) => localized(`/launches/${l.slug}`, new Date(l.windowStart ?? l.launchDate), 0.5)))
  return out
}
