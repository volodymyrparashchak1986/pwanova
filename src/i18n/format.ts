import type { Locale } from "./config"

/** "{count} apps" + { count: 3 } → "3 apps". Unknown placeholders stay visible so a typo is noticed. */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match))
}

export interface PluralForms { one: string; other: string }
export function plural(locale: Locale, count: number, forms: PluralForms, vars: Record<string, string | number> = {}): string {
  const rule = new Intl.PluralRules(locale).select(count)
  return fmt(rule === "one" ? forms.one : forms.other, { count: formatNumber(locale, count), ...vars })
}

export const formatNumber = (locale: Locale, n: number) =>
  new Intl.NumberFormat(locale, { notation: n >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n)

export function formatDate(locale: Locale, iso: string | Date | null | undefined, style: "medium" | "long" = "medium"): string {
  if (!iso) return ""
  const d = typeof iso === "string" ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return ""
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", { dateStyle: style, timeZone: "Europe/Berlin" }).format(d)
}

/** Whole days between a date and now (never negative). */
export function daysSince(iso: string | Date | null | undefined, now: number = Date.now()): number | null {
  if (!iso) return null
  const t = (typeof iso === "string" ? new Date(iso) : iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((now - t) / 86_400_000))
}

export function formatPrice(locale: Locale, cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", {
    style: "currency", currency, minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2,
  }).format(cents / 100)
}

const REGION_NAMES: Partial<Record<Locale, Intl.DisplayNames>> = {}
export function countryName(locale: Locale, code: string | null | undefined): string {
  if (!code) return ""
  try {
    REGION_NAMES[locale] ??= new Intl.DisplayNames([locale], { type: "region" })
    return REGION_NAMES[locale]!.of(code.toUpperCase()) ?? code
  } catch { return code }
}

const LANGUAGE_NAMES: Partial<Record<Locale, Intl.DisplayNames>> = {}
export function languageName(locale: Locale, code: string): string {
  try {
    LANGUAGE_NAMES[locale] ??= new Intl.DisplayNames([locale], { type: "language" })
    const name = LANGUAGE_NAMES[locale]!.of(code) ?? code
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1)
  } catch { return code }
}

/** Pick the text for a locale from a jsonb label ({en, de, …}), falling back to English. */
export function pick(label: Record<string, string> | null | undefined, locale: Locale, fallback = ""): string {
  if (!label) return fallback
  return label[locale] || label.en || Object.values(label)[0] || fallback
}

/** "3 days ago" / "vor 3 Tagen". Whole units only; anything under a minute is "now". */
export function relativeTime(locale: Locale, iso: string | Date | null | undefined, now: number = Date.now()): string {
  if (!iso) return ""
  const t = (typeof iso === "string" ? new Date(iso) : iso).getTime()
  if (Number.isNaN(t)) return ""
  const seconds = Math.round((t - now) / 1000)
  const abs = Math.abs(seconds)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  const units: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31_536_000], ["month", 2_592_000], ["day", 86_400], ["hour", 3600], ["minute", 60]]
  for (const [unit, size] of units) if (abs >= size) return rtf.format(Math.trunc(seconds / size), unit)
  return rtf.format(0, "minute")
}
