import type { Locale } from "../config"
import { de } from "./de"
import { en, type Dictionary } from "./en"

export type { Dictionary }
export const dictionaries: Record<Locale, Dictionary> = { en, de }

/**
 * What client components can read through useI18n() on every page: the texts of the header, the footer,
 * cards, buttons and dialogs. Everything else is rendered on the server and never shipped as a dictionary.
 */
export const CLIENT_NAMESPACES = [
  "common", "nav", "footer", "card", "app", "compare", "filters", "categories", "reviews", "report", "install", "auth", "errors",
] as const satisfies readonly (keyof Dictionary)[]
export type ClientDictionary = Pick<Dictionary, (typeof CLIENT_NAMESPACES)[number]>

/**
 * Texts of forms that exist on a few pages only. A page that renders such a form wraps it in
 * <I18nScope namespaces={[…]}>, so these texts travel with that page and with no other.
 */
export const SCOPED_NAMESPACES = ["dashboard", "submit", "claim", "launches", "requests", "partners", "profile"] as const satisfies readonly (keyof Dictionary)[]
export type ScopedNamespace = (typeof SCOPED_NAMESPACES)[number]
export type ScopedDictionary<N extends ScopedNamespace> = Pick<Dictionary, N>
