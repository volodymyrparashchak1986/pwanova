/**
 * Locale configuration shared by the proxy, server and client code (no server-only imports here).
 * Adding a language later means: add it to LOCALES, add a dictionary, translate. No database change.
 */
export const LOCALES = ["en", "de"] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = "en"
export const LOCALE_COOKIE = "pwn_locale"
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", de: "Deutsch" }
export const OG_LOCALES: Record<Locale, string> = { en: "en_GB", de: "de_DE" }

export const isLocale = (value: string | null | undefined): value is Locale => LOCALES.includes(value as Locale)

/** Routes that exist once, without a language prefix: APIs, auth callbacks, embeds, assets. */
const UNPREFIXED = [
  /^\/api(\/|$)/, /^\/auth(\/|$)/, /^\/embed(\/|$)/, /^\/offline$/, /^\/_next(\/|$)/, /^\/icons(\/|$)/, /^\/\.well-known(\/|$)/,
  /^\/(sw\.js|manifest\.webmanifest|robots\.txt|sitemap\.xml|favicon\.ico|icon|apple-icon|opengraph-image)$/,
]
export const isUnprefixedPath = (pathname: string) => UNPREFIXED.some((r) => r.test(pathname))

export function splitLocale(pathname: string): { locale: Locale | null; path: string } {
  const [, first, ...rest] = pathname.split("/")
  if (isLocale(first)) return { locale: first, path: `/${rest.join("/")}`.replace(/\/+$/, "") || "/" }
  return { locale: null, path: pathname || "/" }
}

/** Prefix an internal path with the locale. External links, anchors and unprefixed routes pass through. */
export function localizeHref(href: string, locale: Locale): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href
  const [pathname] = href.split(/[?#]/)
  if (isUnprefixedPath(pathname) || splitLocale(pathname).locale) return href
  return href === "/" ? `/${locale}` : `/${locale}${href}`
}

/** The same page in another language. */
export function switchLocale(pathname: string, locale: Locale): string {
  const { path } = splitLocale(pathname)
  return path === "/" ? `/${locale}` : `/${locale}${path}`
}

/** Cookie first (an explicit choice), then the browser's Accept-Language, then the default. */
export function negotiateLocale(acceptLanguage: string | null | undefined, cookie: string | null | undefined): Locale {
  if (isLocale(cookie)) return cookie
  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";")
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? 1)
      return { lang: tag.trim().toLowerCase().split("-")[0], q: Number.isFinite(q) ? q : 0 }
    })
    .filter((x) => x.lang && x.q > 0)
    .sort((a, b) => b.q - a.q)
  for (const { lang } of ranked) if (isLocale(lang)) return lang
  return DEFAULT_LOCALE
}

// ------------------------------------------------------------------ v1 → V2 routes
/** v1 category slugs that were folded into a V2 category. Slugs that did not change are not listed. */
const own = <T>(record: Record<string, T>, key: string): T | undefined => (Object.hasOwn(record, key) ? record[key] : undefined)

export const LEGACY_CATEGORY_SLUGS: Record<string, string> = {
  ai: "ai-assistants", business: "business-operations", fitness: "health-fitness", health: "health-fitness",
  social: "communication", entertainment: "media-entertainment", games: "media-entertainment",
  travel: "lifestyle", food: "lifestyle",
}

/** The V2 slug of a v1 category. The slug comes from an address, so only own keys count ("constructor" is not a category). */
export const legacyCategory = (slug: string): string | undefined => own(LEGACY_CATEGORY_SLUGS, slug)

/** Where a v1 path lives now (without locale). Returns null when the path did not move. */
export function legacyTarget(path: string): { path: string; query?: Record<string, string> } | null {
  switch (path) {
    case "/explore": return { path: "/discover" }
    case "/top": return { path: "/discover", query: { sort: "rating" } }
    case "/trending": return { path: "/discover", query: { sort: "trending" } }
    case "/new": return { path: "/discover", query: { sort: "new" } }
    case "/ship": return { path: "/submit" }
    case "/for-developers": return { path: "/for-makers" }
    case "/activity": return { path: "/notifications" }
  }
  const category = path.match(/^\/categories\/([a-z0-9-]+)$/)?.[1]
  const renamed = category ? legacyCategory(category) : undefined
  if (renamed) return { path: `/categories/${renamed}` }
  return null
}

/** hreflang alternates for a page that exists in every language. `path` has no locale prefix. */
export function languageAlternates(path: string, siteUrl: string) {
  const clean = path === "/" ? "" : path
  return {
    languages: {
      ...Object.fromEntries(LOCALES.map((l) => [l, `${siteUrl}/${l}${clean}`])),
      "x-default": `${siteUrl}/${DEFAULT_LOCALE}${clean}`,
    } as Record<string, string>,
  }
}
