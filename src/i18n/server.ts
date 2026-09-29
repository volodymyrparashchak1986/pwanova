import { locale as rootLocale } from "next/root-params"
import { notFound } from "next/navigation"
import { isLocale, localizeHref, type Locale } from "./config"
import { CLIENT_NAMESPACES, dictionaries, type ClientDictionary, type Dictionary } from "./dictionaries"

/** The language of the current request, from the `[locale]` root segment. Server Components only. */
export async function getLocale(): Promise<Locale> {
  const value = await rootLocale()
  if (!isLocale(value)) notFound()
  return value
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale]
}

/** Dictionary + locale + link helper in one call for pages and server components. */
export async function getI18n() {
  const locale = await getLocale()
  return { locale, t: dictionaries[locale], href: (path: string) => localizeHref(path, locale) }
}

/** The part of the dictionary that client components need. Long marketing and legal copy stays on the server. */
export function clientDictionary(locale: Locale): ClientDictionary {
  const full = dictionaries[locale]
  return Object.fromEntries(CLIENT_NAMESPACES.map((ns) => [ns, full[ns]])) as ClientDictionary
}
