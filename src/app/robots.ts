import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/env"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/dashboard", "/auth/", "/embed/", "/profile", "/saved", "/activity"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
