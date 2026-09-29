import { ReportButton } from "@/components/app/report-dialog"
import { sourceLabel } from "@/components/app/detail/sections"
import { answerLabel, SourceLink } from "./fact-row"
import type { Locale } from "@/i18n/config"
import type { Dictionary } from "@/i18n/dictionaries"
import { fmt, formatDate, pick, plural } from "@/i18n/format"
import type { EvidenceItem, FactAttribute } from "@/lib/v2/types"
import { cn } from "@/lib/utils"

/**
 * Everything that was ever recorded about one fact, newest first. Older results are kept and marked
 * as replaced, so a reader can see what changed and when.
 */
export function EvidenceTimeline({ attr, items, t, locale, appSlug, signedIn }: { attr: FactAttribute; items: EvidenceItem[]; t: Dictionary; locale: Locale; appSlug: string; signedIn: boolean }) {
  return (
    <section id={`fact-${attr.key}`} className="scroll-mt-24 rounded-3xl border border-border bg-card p-5 md:p-6" aria-labelledby={`fact-${attr.key}-h`}>
      <h3 id={`fact-${attr.key}-h`} className="text-base font-semibold">{pick(attr.label, locale)}</h3>
      {pick(attr.description, locale) && <p className="mt-1 text-sm text-muted-foreground">{pick(attr.description, locale)}</p>}
      <ol className="mt-4 space-y-3">
        {items.map((e) => {
          const verified = e.sourceType === "pwanova_observed" || e.sourceType === "admin_reviewed"
          const current = e.status === "current"
          return (
            <li key={e.id} className={cn("rounded-2xl border p-4 text-sm", current ? "border-border" : "border-dashed border-border/80 opacity-80")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", e.state === "yes" ? (verified ? "bg-ok/12 text-ok" : "border border-border") : "bg-muted text-muted-foreground")}>{answerLabel(attr, e.state, e.value, locale)}</span>
                <span className={cn("text-xs", verified ? "font-medium text-ok" : "text-muted-foreground")}>{sourceLabel(t.trust, e.sourceType)}</span>
                <span className="text-xs text-muted-foreground">· {t.trust.methods[e.method]}</span>
                <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[11px]", current ? "bg-brand/10 font-medium text-brand" : "bg-muted text-muted-foreground")}>{t.trust.statuses[e.status]}</span>
              </div>
              {e.excerpt && <blockquote className="mt-2 border-l-2 border-border pl-3 text-muted-foreground">{e.excerpt}</blockquote>}
              <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <div className="flex gap-1"><dt>{t.trust.firstSeen}:</dt><dd><time dateTime={e.collectedAt}>{formatDate(locale, e.collectedAt)}</time></dd></div>
                {e.lastConfirmedAt && <div><dd>{fmt(t.trust.lastConfirmed, { date: formatDate(locale, e.lastConfirmedAt) })}</dd></div>}
                {e.confirmations > 1 && <div><dd>{plural(locale, e.confirmations, t.trust.confirmedTimes)}</dd></div>}
                <div className="flex gap-1"><dt>{t.trust.source}:</dt><dd>{e.sourceUrl ? <SourceLink url={e.sourceUrl} label={e.sourceTitle || t.trust.viewSource} /> : t.trust.noSource}</dd></div>
              </dl>
              {current && (
                <p className="mt-2"><ReportButton target={{ evidenceId: e.id }} kind="evidence" title={t.report.titleEvidence} label={t.trust.reportIncorrect} signedIn={signedIn} next={`/apps/${appSlug}/evidence`} /></p>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
