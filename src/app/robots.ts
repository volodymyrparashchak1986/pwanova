import type { MetadataRoute } from "next"
import { LOCALES } from "@/i18n/config"
import { allowIndexing, siteUrl } from "@/lib/env"

/** Personal and administrative pages, in every language edition. They also carry a noindex of their own. */
const PRIVATE = ["/admin", "/dashboard", "/profile", "/saved", "/notifications", "/sign-in", "/submit", "/requests/new"]

export default function robots(): MetadataRoute.Robots {
  if (!allowIndexing) return { rules: [{ userAgent: "*", disallow: "/" }] }
  return {
    rules: [{
      userAgent: "*", allow: "/",
      disallow: ["/api/", "/auth/", "/embed/", "/offline", ...LOCALES.flatMap((l) => PRIVATE.map((p) => `/${l}${p}`))],
    }],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
