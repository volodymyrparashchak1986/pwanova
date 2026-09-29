import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { AppIcon } from "@/components/app/app-icon"
import { ReportButton } from "@/components/app/report-dialog"
import { PageShell } from "@/components/app/section-header"
import { Link } from "@/components/i18n/link"
import { EvidenceTimeline } from "@/components/trust/evidence-timeline"
import { CompletenessMeter } from "@/components/trust/trust-snapshot"
import { VerificationStatus } from "@/components/trust/trust-signal"
import { isLocale } from "@/i18n/config"
import { fmt, formatDate } from "@/i18n/format"
import { getDictionary, getI18n } from "@/i18n/server"
import { getViewer } from "@/lib/data"
import { getAppDetail, getEvidenceHistory, getFactRegistry, getVerificationRuns } from "@/lib/data/catalog"
import { pageMetadata } from "@/lib/seo"
import type { Dimension, EvidenceItem } from "@/lib/v2/types"

type Props = PageProps<"/[locale]/apps/[slug]/evidence">

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const detail = await getAppDetail(slug)
  if (!detail) return { robots: { index: false, follow: false } }
  const t = getDictionary(locale)
  // The history is a reference for people who look for it; the product page is the one to index.
  return pageMetadata({ locale, path: `/apps/${slug}/evidence`, title: fmt(t.app.evidenceTitle, { name: detail.app.name }), description: t.app.evidenceBody, index: false })
}

const ORDER: Dimension[] = ["company", "data", "ai", "technical", "product"]

export default async function EvidencePage({ params }: Props) {
  const [{ slug }, { t, locale }, viewer] = await Promise.all([params, getI18n(), getViewer()])
  const detail = await getAppDetail(slug)
  if (!detail) notFound()
  const { app } = detail
  const [registry, history, runs] = await Promise.all([getFactRegistry(), getEvidenceHistory(app.id), getVerificationRuns(app.id, 10)])
  const byKey = new Map<string, EvidenceItem[]>()
  for (const e of history) byKey.set(e.key, [...(byKey.get(e.key) ?? []), e])
  const documented = registry.filter((a) => byKey.has(a.key))
  const open = registry.filter((a) => a.isExpected && !byKey.has(a.key))

  return (
    <PageShell className="max-w-4xl">
      <Link href={`/apps/${app.slug}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />{fmt(t.app.backToApp, { name: app.name })}</Link>
      <header className="mt-4 flex items-start gap-4">
        <AppIcon app={app} size="md" />
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">{fmt(t.app.evidenceTitle, { name: app.name })}</h1>
          <p className="mt-1 text-muted-foreground">{t.app.evidenceBody}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <VerificationStatus state={app.verificationState} checkedAt={app.evidenceCheckedAt} t={t.trust} locale={locale} />
            {app.evidenceCheckedAt && <span className="text-sm text-muted-foreground">{fmt(t.trust.lastChecked, { date: formatDate(locale, app.evidenceCheckedAt) })}</span>}
          </div>
        </div>
      </header>

      <div className="mt-6 rounded-3xl border border-border bg-card p-5 md:p-6"><CompletenessMeter score={app.evidenceScore} t={t.trust} /></div>

      {ORDER.map((d) => {
        const attrs = documented.filter((a) => a.dimension === d)
        if (!attrs.length) return null
        return (
          <section key={d} className="mt-10" aria-labelledby={`dim-${d}`}>
            <h2 id={`dim-${d}`} className="mb-4 text-2xl font-semibold tracking-tight">{t.trust.dimensions[d]}</h2>
            <div className="space-y-4">{attrs.map((a) => <EvidenceTimeline key={a.key} attr={a} items={byKey.get(a.key) ?? []} t={t} locale={locale} appSlug={app.slug} signedIn={Boolean(viewer)} />)}</div>
          </section>
        )
      })}
      {!documented.length && <p className="mt-8 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">{t.trust.historyEmpty}</p>}

      {open.length > 0 && (
        <section className="mt-10" aria-labelledby="open-h">
          <h2 id="open-h" className="text-2xl font-semibold tracking-tight">{t.trust.notVerified}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.trust.notVerifiedLong}</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {open.map((a) => <li key={a.key} className="rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground">{a.label[locale] || a.label.en}</li>)}
          </ul>
          {app.ownershipStatus !== "verified_owner" && <p className="mt-4 text-sm"><Link href={`/apps/${app.slug}/claim`} className="font-medium text-brand hover:underline">{t.trust.ownThisApp}</Link></p>}
        </section>
      )}

      {runs.length > 0 && (
        <section className="mt-10" aria-labelledby="runs-h">
          <h2 id="runs-h" className="text-2xl font-semibold tracking-tight">{t.trust.runsTitle}</h2>
          <ul className="mt-4 divide-y divide-border/70 rounded-3xl border border-border bg-card px-5">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-sm">
                <span className="font-medium"><time dateTime={r.startedAt}>{formatDate(locale, r.startedAt)}</time> · {(t.trust.runTypes as Record<string, string>)[r.runType] ?? r.runType}</span>
                <span className="text-muted-foreground">{fmt(t.trust.runSummary, { found: r.found, notFound: r.notFound, failed: r.failed })}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">{t.trust.couldNotCheckLong}</p>
        </section>
      )}

      <section id="report" className="mt-10 scroll-mt-24 rounded-3xl border border-border bg-accent/40 p-5 text-sm">
        <p className="font-semibold">{t.trust.reportIncorrect}</p>
        <p className="mt-1 text-muted-foreground">{t.report.body} {t.trust.notACertificate}</p>
        <p className="mt-3"><ReportButton target={{ appId: app.id }} kind="evidence" title={t.report.titleEvidence} label={t.report.submit} signedIn={Boolean(viewer)} next={`/apps/${app.slug}/evidence`} className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted" /></p>
      </section>
    </PageShell>
  )
}
