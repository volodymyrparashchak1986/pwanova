import type { Metadata } from "next"
import { languageAlternates, OG_LOCALES, type Locale } from "@/i18n/config"
import { siteUrl } from "@/lib/env"

export const absoluteUrl = (locale: Locale, path: string) => `${siteUrl}/${locale}${path === "/" ? "" : path}`

/**
 * Metadata for a page that exists in every language: canonical to itself, hreflang to its siblings.
 * `index: false` keeps a page out of search engines while its links are still followed
 * (private pages, filtered result lists, pages with too little content).
 */
export function pageMetadata(o: { locale: Locale; path: string; title: string; description?: string; index?: boolean; canonicalPath?: string; absoluteTitle?: boolean }): Metadata {
  const canonical = absoluteUrl(o.locale, o.canonicalPath ?? o.path)
  return {
    title: o.absoluteTitle ? { absolute: o.title } : o.title,
    description: o.description,
    alternates: { canonical, ...languageAlternates(o.canonicalPath ?? o.path, siteUrl) },
    robots: o.index === false ? { index: false, follow: true } : undefined,
    openGraph: { title: o.title, description: o.description, url: canonical, locale: OG_LOCALES[o.locale], type: "website" },
    twitter: { card: "summary_large_image", title: o.title, description: o.description },
  }
}

/** Private or personal pages: never indexed, no alternates advertised. */
export const privateMetadata = (title: string): Metadata => ({ title, robots: { index: false, follow: false } })
