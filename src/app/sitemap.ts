import type { MetadataRoute } from "next"
import { CATEGORIES } from "@/lib/constants"
import { getSitemapData } from "@/lib/data"
import { siteUrl } from "@/lib/env"

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { apps, devs } = await getSitemapData()
  const now = new Date()
  return [
    ...["", "/explore", "/top", "/trending", "/new", "/categories", "/for-developers", "/partners", "/pricing"].map((p) => ({ url: `${siteUrl}${p}`, lastModified: now })),
    ...CATEGORIES.map((c) => ({ url: `${siteUrl}/categories/${c.slug}`, lastModified: now })),
    ...apps.filter((a) => !a.isDemo).map((a) => ({ url: `${siteUrl}/apps/${a.slug}`, lastModified: new Date(a.updatedAt) })),
    ...devs.filter((d) => !apps.find((a) => a.developer.username === d)?.isDemo).map((d) => ({ url: `${siteUrl}/developers/${d}` })),
  ]
}
