import { ArrowRight, Flag } from "lucide-react"
import { Link } from "@/components/i18n/link"
import { TrustSignal, VerificationStatus } from "./trust-signal"
import { answerLabel } from "./fact-row"
import type { Locale } from "@/i18n/config"
import type { Dictionary } from "@/i18n/dictionaries"
import { daysSince, fmt, formatDate, pick } from "@/i18n/format"
import { snapshotFacts, SNAPSHOT_KEYS, summarizeDimensions } from "@/lib/v2/trust"
import type { AppFact, CatalogApp, FactAttribute } from "@/lib/v2/types"

export function CompletenessMeter({ score, t, className }: { score: number; t: Dictionary["trust"]; className?: string }) {
  const value = Math.max(0, Math.min(100, Math.round(score)))
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{t.evidenceCompleteness}</span>
        <span className="tabular-nums text-muted-foreground">{fmt(t.scoreLabel, { score: value })}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={t.evidenceCompleteness}>
        <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{t.evidenceCompletenessHelp}</p>
    </div>
  )
}

/**
 * The first thing a buyer sees about trust: eight facts, each with one of three answers and its origin,
 * how complete the evidence is and when it was last checked. It is a record, not a verdict.
 */
export function TrustSnapshot({ app, facts, registry, t, locale }: { app: CatalogApp; facts: AppFact[]; registry: FactAttribute[]; t: Dictionary; locale: Locale }) {
  const rows = snapshotFacts(facts, registry, SNAPSHOT_KEYS)
  const dims = summarizeDimensions(facts, registry)
  const verified = dims.reduce((s, d) => s + d.verified, 0)
  const vendor = dims.reduce((s, d) => s + d.vendor, 0)
  const unknown = dims.reduce((s, d) => s + d.unknown, 0)
  const days = daysSince(app.evidenceCheckedAt)
  return (
    <section id="trust" aria-labelledby="trust-h" className="scroll-mt-24 rounded-3xl border border-border bg-card p-5 shadow-soft md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="trust-h" className="text-lg font-semibold">{t.trust.snapshot}</h2>
        <VerificationStatus state={app.verificationState} checkedAt={app.evidenceCheckedAt} t={t.trust} locale={locale} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {t.trust.stateHelp[app.verificationState]}{" "}
        {app.evidenceCheckedAt && (days !== null && days > 180 ? fmt(t.trust.staleLong, { count: days }) : fmt(t.trust.lastChecked, { date: formatDate(locale, app.evidenceCheckedAt) }))}
      </p>
      <ul className="mt-4 grid gap-x-8 sm:grid-cols-2">
        {rows.map(({ attr, fact }) => {
          const state = fact?.effectiveState ?? "unknown"
          const origin = fact?.origin ?? "none"
          const raw = origin === "verified" ? fact?.verifiedValue ?? null : origin === "vendor" ? fact?.vendorValue ?? null : null
          return (
            <li key={attr.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border/60 py-2.5 text-sm">
              {/* on a narrow screen the answer moves below its question; the question is never cut off */}
              <span className="min-w-0 break-words">{pick(attr.label, locale)}</span>
              <TrustSignal label={answerLabel(attr, state, raw, locale)} state={state} origin={origin} date={origin === "verified" ? fact?.verifiedAt : fact?.vendorStatedAt} t={t.trust} locale={locale} answerOnly />
            </li>
          )
        })}
      </ul>
      <CompletenessMeter score={app.evidenceScore} t={t.trust} className="mt-5" />
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{fmt(t.trust.countVerified, { count: verified })}</span><span>{fmt(t.trust.countVendor, { count: vendor })}</span><span>{fmt(t.trust.countUnknown, { count: unknown })}</span>
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4 text-sm">
        <Link href={`/apps/${app.slug}/evidence`} className="inline-flex items-center gap-1 font-medium text-brand hover:underline">{t.app.readEvidence}<ArrowRight className="size-4" aria-hidden /></Link>
        <Link href={`/apps/${app.slug}/evidence#report`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"><Flag className="size-3.5" aria-hidden />{t.trust.reportIncorrect}</Link>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{t.trust.notACertificate}</p>
    </section>
  )
}
