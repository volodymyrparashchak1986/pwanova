import { ExternalLink } from "lucide-react"
import { TrustSignal } from "./trust-signal"
import type { Locale } from "@/i18n/config"
import type { Dictionary } from "@/i18n/dictionaries"
import { countryName, fmt, formatDate, pick } from "@/i18n/format"
import { factLabel } from "@/lib/v2/trust"
import type { AppFact, FactAttribute, FactState } from "@/lib/v2/types"

type TrustText = Dictionary["trust"]

/** A source is shown as a link only when it is a plain http(s) URL. Anything else is printed as text. */
export function SourceLink({ url, label }: { url: string | null; label: string }) {
  if (!url) return null
  if (!/^https?:\/\//i.test(url)) return <span className="break-all">{url}</span>
  let host = url
  try { host = new URL(url).hostname.replace(/^www\./, "") } catch { /* printed as given */ }
  return (
    <a href={url} target="_blank" rel="nofollow noopener noreferrer ugc" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
      {label} <span className="font-normal text-muted-foreground">({host})</span><ExternalLink className="size-3" aria-hidden />
    </a>
  )
}

export function displayValue(attr: FactAttribute, value: string | null, locale: Locale): string | null {
  if (!value) return null
  if (attr.valueType === "country" || /^[A-Z]{2}$/.test(value)) return countryName(locale, value)
  if (attr.valueType === "url") return null // the URL is the source link, not a value to print twice
  return value
}

/**
 * The answer in words. "Yes" next to "Training on customer data" would say the opposite of what the
 * fact means, so every answer is spelled out: "No training on customer data", "No DPA published".
 * A country is answered with the country.
 */
export function answerLabel(attr: FactAttribute, state: FactState, value: string | null, locale: Locale): string {
  if (state === "unknown") return pick(attr.label, locale)
  if (attr.valueType === "country" && value) return countryName(locale, value)
  return factLabel(attr, state, locale)
}

function Layer({ title, attr, state, value, url, date, dateTemplate, t, locale }: { title: string; attr: FactAttribute; state: FactState; value: string | null; url: string | null; date: string | null; dateTemplate: string; t: TrustText; locale: Locale }) {
  if (state === "unknown") return null
  const shown = attr.valueType === "country" ? null : displayValue(attr, value, locale)
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <p className="font-medium text-foreground">{title}: {answerLabel(attr, state, value, locale)}{shown ? ` · ${shown}` : ""}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        {url ? <SourceLink url={url} label={t.viewSource} /> : <span>{t.noSource}</span>}
        {date && <span>{fmt(dateTemplate, { date })}</span>}
      </p>
    </div>
  )
}

/**
 * One fact with its answer and, on request, how PWANova knows. PWANova's own result and the
 * vendor's statement are separate layers: when both exist, both are shown.
 */
export function FactRow({ attr, fact, t, locale }: { attr: FactAttribute; fact: AppFact | null; t: TrustText; locale: Locale }) {
  const state = fact?.effectiveState ?? "unknown"
  const origin = fact?.origin ?? "none"
  const raw = origin === "verified" ? fact?.verifiedValue ?? null : origin === "vendor" ? fact?.vendorValue ?? null : null
  const value = attr.valueType === "country" ? null : displayValue(attr, raw, locale)
  const date = origin === "verified" ? fact?.verifiedAt : origin === "vendor" ? fact?.vendorStatedAt : null
  const differ = fact && fact.verifiedState !== "unknown" && fact.vendorState !== "unknown" && fact.verifiedState !== fact.vendorState
  const failed = fact?.lastAttemptOutcome === "could_not_check" && fact.lastAttemptAt
  const description = pick(attr.description, locale)
  const sourceNote = origin === "verified" ? (fact?.verifiedSourceType === "admin_reviewed" ? t.sourceReviewed : t.sourceObserved) : origin === "vendor" ? t.sourceVendor : null
  return (
    <li className="py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{pick(attr.label, locale)}</p>
          {value && <p className="text-sm text-muted-foreground">{value}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          <TrustSignal label={answerLabel(attr, state, raw, locale)} state={state} origin={origin} date={date} t={t} locale={locale} size="md" answerOnly />
          {sourceNote && <span className="text-[11px] text-muted-foreground">{sourceNote}{date ? ` · ${formatDate(locale, date)}` : ""}</span>}
        </div>
      </div>
      <details className="group mt-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer list-none font-medium text-foreground/70 underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">{t.howDoWeKnow}</summary>
        <div className="mt-2 space-y-2">
          {description && <p>{description}</p>}
          {state === "unknown" && <p>{t.notVerifiedLong}</p>}
          <Layer title={fact?.verifiedSourceType === "admin_reviewed" ? t.sourceReviewed : t.pwanovaFound} attr={attr} state={fact?.verifiedState ?? "unknown"} value={fact?.verifiedValue ?? null} url={fact?.verifiedSourceUrl ?? null} date={fact?.verifiedAt ? formatDate(locale, fact.verifiedAt) : null} dateTemplate={t.lastChecked} t={t} locale={locale} />
          <Layer title={t.vendorStates} attr={attr} state={fact?.vendorState ?? "unknown"} value={fact?.vendorValue ?? null} url={fact?.vendorSourceUrl ?? null} date={fact?.vendorStatedAt ? formatDate(locale, fact.vendorStatedAt) : null} dateTemplate={t.statedOn} t={t} locale={locale} />
          {differ && <p className="font-medium text-warn">{t.layersDiffer}</p>}
          {failed && <p>{fmt(t.lastAttemptFailed, { date: formatDate(locale, fact.lastAttemptAt) })}</p>}
        </div>
      </details>
    </li>
  )
}

export function FactList({ attrs, facts, t, locale }: { attrs: FactAttribute[]; facts: AppFact[]; t: TrustText; locale: Locale }) {
  const byKey = new Map(facts.map((f) => [f.key, f]))
  if (!attrs.length) return <p className="text-sm text-muted-foreground">{t.factsEmpty}</p>
  return <ul className="divide-y divide-border/70">{attrs.map((attr) => <FactRow key={attr.key} attr={attr} fact={byKey.get(attr.key) ?? null} t={t} locale={locale} />)}</ul>
}
