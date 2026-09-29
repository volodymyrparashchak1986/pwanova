"use client"

import { createContext, useContext, useMemo } from "react"
import { DEFAULT_LOCALE, localizeHref, type Locale } from "./config"
import type { ClientDictionary, Dictionary, ScopedDictionary, ScopedNamespace } from "./dictionaries"

interface I18nValue { locale: Locale; t: ClientDictionary & Partial<Pick<Dictionary, ScopedNamespace>> }
const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ locale, dictionary, children }: { locale: Locale; dictionary: ClientDictionary; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, t: dictionary }), [locale, dictionary])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** Adds the texts of page-specific forms for everything below it. Rendered by <I18nScope> on the server. */
export function I18nExtend({ dictionary, children }: { dictionary: Partial<Pick<Dictionary, ScopedNamespace>>; children: React.ReactNode }) {
  const parent = useContext(I18nContext)
  const value = useMemo(() => (parent ? { locale: parent.locale, t: { ...parent.t, ...dictionary } } : null), [parent, dictionary])
  if (!value) throw new Error("I18nExtend must be used inside <I18nProvider>")
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/**
 * Texts, language and link helper for a client component. A component that needs the texts of a
 * page-specific form names them: useI18n("dashboard", "submit"). Missing texts fail loudly, with the
 * name of the scope that has to be added to the page.
 */
export function useI18n<N extends ScopedNamespace = never>(...scopes: N[]): { locale: Locale; t: ClientDictionary & ScopedDictionary<N>; href: (path: string) => string } {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>")
  for (const scope of scopes) {
    if (!ctx.t[scope]) throw new Error(`The texts "${scope}" are not available here. Wrap the page content in <I18nScope namespaces={["${scope}"]}>.`)
  }
  return { locale: ctx.locale, t: ctx.t as ClientDictionary & ScopedDictionary<N>, href: (path: string) => localizeHref(path, ctx.locale) }
}

/** Locale only. Safe outside the provider (embeds, offline page): falls back to the default language. */
export function useLocale(): Locale {
  return useContext(I18nContext)?.locale ?? DEFAULT_LOCALE
}
