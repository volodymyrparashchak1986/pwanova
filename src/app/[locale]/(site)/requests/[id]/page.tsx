import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { AppIcon } from "@/components/app/app-icon"
import { ReportButton } from "@/components/app/report-dialog"
import { PageShell } from "@/components/app/section-header"
import { Link } from "@/components/i18n/link"
import { ContactForm, OwnerActions, ShareContact } from "@/components/requests/request-actions"
import { MatchReasons, RequestFacts, Requirements } from "@/components/requests/request-parts"
import { VerificationStatus } from "@/components/trust/trust-signal"
import { buttonVariants } from "@/components/ui/button"
import { isLocale } from "@/i18n/config"
import { I18nScope } from "@/i18n/scope"
import { fmt, formatDate } from "@/i18n/format"
import { getDictionary, getI18n } from "@/i18n/server"
import { getViewer } from "@/lib/data"
import { getPublicSettings } from "@/lib/data/catalog"
import { getLookups } from "@/lib/data/lookups"
import { getRequest, getRequestContact, getRequestMatches, getRequestResponses } from "@/lib/data/requests"
import { comparisonKey } from "@/lib/v2/compare"
import { cn } from "@/lib/utils"

type Props = PageProps<"/[locale]/requests/[id]">

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params
  if (!isLocale(locale)) return {}
  const request = await getRequest(id)
  // A request is somebody's purchase project. It is reachable by its link, not through a search engine.
  return { title: request?.title ?? getDictionary(locale).requests.detailTitle, robots: { index: false, follow: false } }
}

export default async function RequestPage({ params }: Props) {
  const [{ id }, { t, locale }, viewer, settings] = await Promise.all([params, getI18n(), getViewer(), getPublicSettings()])
  if (!settings.features.requests) notFound()
  const request = await getRequest(id)
  if (!request) notFound()
  const mine = viewer?.id === request.ownerId
  const [lookups, matches, responses, contact] = await Promise.all([
    getLookups(),
    mine ? getRequestMatches(request.uuid) : Promise.resolve([]),
    mine ? getRequestResponses(request.uuid) : Promise.resolve([]),
    mine ? getRequestContact(request.uuid) : Promise.resolve(null),
  ])
  const status = (t.requests.status as Record<string, string>)[request.status] ?? request.status

  return (
    <I18nScope namespaces={["requests"]}>
    <PageShell className="max-w-4xl">
      <Link href="/requests" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />{t.requests.title}</Link>
      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className={cn("rounded-full px-2 py-0.5 font-medium", request.visibility === "public" ? "bg-brand/10 text-brand" : "bg-muted")}>{request.visibility === "public" ? t.requests.publicTag : t.requests.privateTag}</span>
          <span className="rounded-full border border-border px-2 py-0.5">{status}</span>
          <time dateTime={request.createdAt}>{fmt(t.requests.postedOn, { date: formatDate(locale, request.createdAt) })}</time>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance md:text-4xl">{request.title}</h1>
        {mine && <div className="mt-4"><OwnerActions publicId={request.id} status={request.status} /></div>}
      </header>

      <section className="mt-8 rounded-3xl border border-border bg-card p-5 md:p-6" aria-labelledby="req-h">
        <h2 id="req-h" className="text-lg font-semibold">{t.requests.requirements}</h2>
        <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line text-foreground/90">{request.problem}</p>
        <div className="mt-4"><RequestFacts request={request} t={t} locale={locale} /></div>
        <Requirements request={request} t={t} locale={locale} lookups={lookups} className="mt-4" />
        {(request.mustHave.length > 0 || request.niceToHave.length > 0) && (
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {([[t.requests.fields.mustHave, request.mustHave], [t.requests.fields.niceToHave, request.niceToHave]] as const).filter(([, l]) => l.length).map(([title, list]) => (
              <div key={title}><h3 className="text-sm font-semibold">{title}</h3><ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-foreground/85">{list.map((l) => <li key={l}>{l}</li>)}</ul></div>
            ))}
          </div>
        )}
      </section>

      {mine && (
        <>
          <section className="mt-10" aria-labelledby="matches-h">
            <h2 id="matches-h" className="text-2xl font-semibold tracking-tight">{t.requests.matchesTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.requests.matchesBody}</p>
            {matches.length ? (
              <>
                <ol className="mt-4 space-y-3">
                  {matches.map((m) => (
                    <li key={m.app.id} className="rounded-3xl border border-border bg-card p-5">
                      <div className="flex flex-wrap items-start gap-4">
                        <AppIcon app={m.app} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">{fmt(t.requests.rank, { rank: m.rank })} · {fmt(t.requests.reasons.score, { met: m.met, total: m.total })}</p>
                          <h3 className="text-lg font-semibold"><Link href={`/apps/${m.app.slug}?from=request`} className="hover:underline">{m.app.name}</Link></h3>
                          <p className="text-sm text-muted-foreground">{(locale === "de" && m.app.taglineDe) || m.app.tagline}</p>
                        </div>
                        <VerificationStatus state={m.app.verificationState} checkedAt={m.app.evidenceCheckedAt} t={t.trust} locale={locale} className="px-2 py-0.5 text-[11px]" />
                      </div>
                      <div className="mt-3"><p className="mb-1.5 text-xs font-medium text-muted-foreground">{t.requests.why}</p><MatchReasons requirements={m.requirements} t={t} locale={locale} lookups={lookups} /></div>
                    </li>
                  ))}
                </ol>
                {settings.features.compare && matches.length >= 2 && (
                  <Link href={`/compare/${comparisonKey(matches.slice(0, 4).map((m) => m.app.slug))}`} className={cn(buttonVariants({ variant: "outline" }), "mt-4 rounded-full")}>{t.compare.open}</Link>
                )}
              </>
            ) : <p className="mt-4 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">{t.requests.matchesEmpty}</p>}
          </section>

          <section className="mt-10" aria-labelledby="responses-h">
            <h2 id="responses-h" className="text-2xl font-semibold tracking-tight">{t.requests.responsesTitle}</h2>
            {responses.length ? (
              <ul className="mt-4 space-y-3">
                {responses.map((r) => {
                  const shared = r.status === "contact_shared" && r.consent && !r.consent.revokedAt
                  return (
                    <li key={r.id} className="rounded-3xl border border-border bg-card p-5">
                      <div className="flex flex-wrap items-center gap-3">
                        <AppIcon app={r.app} size="sm" className="size-10! rounded-xl! text-base!" />
                        <p className="min-w-0 flex-1 font-semibold"><Link href={`/apps/${r.app.slug}`} className="hover:underline">{r.app.name}</Link><span className="block text-xs font-normal text-muted-foreground">{formatDate(locale, r.createdAt)} · {(t.requests.responseStatus as Record<string, string>)[r.status] ?? r.status}</span></p>
                        {(r.status === "interested" || shared) && <ShareContact publicId={request.id} responseId={r.id} vendorName={r.app.name} contact={contact} shared={Boolean(shared)} />}
                      </div>
                      {r.message && <blockquote className="mt-3 border-l-2 border-border pl-3 text-sm whitespace-pre-line text-foreground/85">{r.message}</blockquote>}
                      {shared && r.consent && (
                        <p className="mt-3 text-xs text-muted-foreground">{fmt(t.requests.shared, { date: formatDate(locale, r.consent.grantedAt) })} · {t.requests.sharedFields}: {r.consent.sharedFields.map((k) => (t.requests.fieldNames as Record<string, string>)[k] ?? k).join(", ")}</p>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : <p className="mt-4 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">{t.requests.responsesEmpty}</p>}
          </section>

          <section className="mt-10 rounded-3xl border border-border bg-card p-5 md:p-6" aria-labelledby="contact-h">
            <h2 id="contact-h" className="text-lg font-semibold">{t.requests.fields.contact}</h2>
            <p className="mt-1 mb-4 text-sm text-muted-foreground">{t.requests.contactHelp}</p>
            <ContactForm publicId={request.id} contact={contact} />
          </section>
        </>
      )}

      {!mine && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">{t.requests.vendor.body}</p>
          <div className="flex items-center gap-4">
            <Link href="/dashboard/requests" className="font-medium text-brand hover:underline">{t.requests.vendor.title}</Link>
            <ReportButton target={{ requestId: request.uuid }} kind="app" title={t.requests.reportRequest} label={t.reviews.report} signedIn={Boolean(viewer)} next={`/requests/${request.id}`} />
          </div>
        </div>
      )}
    </PageShell>
    </I18nScope>
  )
}
