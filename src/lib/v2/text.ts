import type { Locale } from "@/i18n/config"
import type { CatalogApp } from "./types"

type Texts = Pick<CatalogApp, "tagline" | "description" | "taglineDe" | "descriptionDe" | "contentLocale">

/**
 * Vendor text in the visitor's language when a translation exists, otherwise the original.
 * `original` tells the page to say so, instead of showing a machine translation nobody reviewed.
 */
export function localizedText(app: Texts, locale: Locale): { tagline: string; description: string; original: boolean; lang: string } {
  if (locale === "de" && app.contentLocale !== "de") {
    const tagline = app.taglineDe?.trim()
    const description = app.descriptionDe?.trim()
    if (tagline || description) {
      return { tagline: tagline || app.tagline, description: description || app.description, original: !description && Boolean(app.description), lang: description ? "de" : app.contentLocale }
    }
  }
  return { tagline: app.tagline, description: app.description, original: app.contentLocale !== locale && Boolean(app.description), lang: app.contentLocale }
}

/** Plain-text excerpt for meta descriptions: one line, cut at a word boundary. */
export function excerpt(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max - 1)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 40)).replace(/[\s,;:.–-]+$/, "")}…`
}
