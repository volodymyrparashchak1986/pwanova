import type { Locale } from "@/i18n/config"
import { countryName, languageName } from "@/i18n/format"
import type { Choice } from "@/components/form/fields"
import { COUNTRIES, LANGUAGES } from "./options"

/**
 * Country and language names come from Intl, and the server's and a browser's data can differ in
 * wording and in sort order. The lists are therefore built once, on the server, and handed to the forms.
 */
export function countryChoices(locale: Locale): Choice[] {
  return [...COUNTRIES].map((value) => ({ value, label: countryName(locale, value) })).sort((a, b) => a.label.localeCompare(b.label, locale))
}

export function languageChoices(locale: Locale, limit: number = LANGUAGES.length): Choice[] {
  return LANGUAGES.slice(0, limit).map((value) => ({ value, label: languageName(locale, value) }))
}
