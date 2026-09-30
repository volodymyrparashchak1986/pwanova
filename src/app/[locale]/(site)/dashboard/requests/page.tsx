import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft, Lock } from "lucide-react"
import { EmptyState, PageHeader, PageShell } from "@/components/app/section-header"
import { Link } from "@/components/i18n/link"
import { VendorRespond } from "@/components/requests/request-actions"
import { RequestFacts, Requirements } from "@/components/requests/request-parts"
import { isLocale } from "@/i18n/config"
import { I18nScope } from "@/i18n/scope"
import { fmt, formatDate } from "@/i18n/format"
import { getDictionary, getI18n } from "@/i18n/server"
import { requireViewer } from "@/lib/auth"
import { getPublicSettings } from "@/lib/data/catalog"
import { getLookups } from "@/lib/data/lookups"
import { getVendorRequests } from "@/lib/data/requests"
import { privateMetadata } from "@/lib/seo"

export async function generateMetadata({ params }: PageProps<"/[locale]/dashboard/requests">): Promise<Metadata> {
  const { locale } = await params
  return privateMetadata(isLocale(locale) ? getDictionary(locale).requests.vendor.title : "Requests")
}

export default async function VendorRequestsPage() {
  const [{ t, locale }, settings] = await Promise.all([getI18n(), getPublicSettings()])
  if (!settings.features.requests) notFound()
  const viewer = await requireViewer("/dashboard/requests")
  const [items, lookups] = await Promise.all([getVendorRequests(viewer.id), getLookups()])
  const v = t.requests.vendor
  return (
    <I18nScope namespaces={["requests"]}>
    <PageShell className="max-w-4xl">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />{t.dashboard.back}</Link>
      <div className="mt-4"><PageHeader title={v.title} body={v.body} /></div>
      {settings.monetizationEnforced && <p className="mb-6 rounded-2xl border border-border bg-accent/40 p-4 text-sm">{v.notEntitled}</p>}
      {items.length ? (
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={`${item.request.uuid}:${item.app.id}`} className="rounded-3xl border border-border bg-card p-5 md:p-6">
              <p className="text-xs text-muted-foreground">
                {fmt(t.requests.postedOn, { date: formatDate(locale, item.request.createdAt) })} · {item.app.name} · {fmt(t.requests.rank, { rank: item.rank })} · {fmt(t.requests.reasons.score, { met: item.met, total: item.total })}
              </p>
              <h2 className="mt-1 text-lg font-semibold">{item.request.title}</h2>
              <p className="mt-1 text-sm whitespace-pre-line text-foreground/85">{item.request.problem}</p>
              <div className="mt-3"><RequestFacts request={item.request} t={t} locale={locale} /></div>
              <Requirements request={item.request} t={t} locale={locale} lookups={lookups} className="mt-3" />
              {item.request.mustHave.length > 0 && <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-foreground/85">{item.request.mustHave.map((m) => <li key={m}>{m}</li>)}</ul>}

              {item.contact && (
                <div className="mt-4 rounded-2xl border border-ok/40 bg-ok/10 p-4 text-sm">
                  <p className="flex items-center gap-2 font-semibold"><Lock className="size-4" aria-hidden />{t.dashboard.contactShared}</p>
                  <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                    {Object.entries(item.contact).filter(([k]) => k !== "granted_at").map(([k, value]) => <div key={k}><dt className="text-xs text-muted-foreground">{(t.requests.fieldNames as Record<string, string>)[k] ?? k}</dt><dd className="font-medium break-words">{value}</dd></div>)}
                  </dl>
                  <p className="mt-2 text-xs text-muted-foreground">{t.dashboard.contactUse}</p>
                </div>
              )}
              <div className="mt-4 border-t border-border/70 pt-4"><VendorRespond requestId={item.request.uuid} appId={item.app.id} response={item.response} /></div>
            </li>
          ))}
        </ul>
      ) : <EmptyState title={v.empty} body={v.verifiedOnly} />}
    </PageShell>
    </I18nScope>
  )
}
