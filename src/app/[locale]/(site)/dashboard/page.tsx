import type { Metadata } from "next"
import { AlertTriangle, Inbox, Plus } from "lucide-react"
import { AppIcon } from "@/components/app/app-icon"
import { OwnershipBadge } from "@/components/app/badges"
import { BarList, TrendChart } from "@/components/app/charts"
import { EmptyState, PageHeader, PageShell } from "@/components/app/section-header"
import { SignedOutCard } from "@/components/app/signed-out"
import { Link } from "@/components/i18n/link"
import { VerificationStatus } from "@/components/trust/trust-signal"
import { buttonVariants } from "@/components/ui/button"
import { isLocale } from "@/i18n/config"
import { fmt, formatNumber } from "@/i18n/format"
import { getDictionary, getI18n } from "@/i18n/server"
import { getDashboard, getViewer } from "@/lib/data"
import { getPublicSettings } from "@/lib/data/catalog"
import { getMakerApps, getMakerCounters } from "@/lib/data/maker"
import { demoMode, isSupabaseConfigured } from "@/lib/env"
import { privateMetadata } from "@/lib/seo"
import { cn } from "@/lib/utils"

export async function generateMetadata({ params }: PageProps<"/[locale]/dashboard">): Promise<Metadata> {
  const { locale } = await params
  return privateMetadata(isLocale(locale) ? getDictionary(locale).dashboard.title : "Dashboard")
}

export default async function DashboardPage({ searchParams }: PageProps<"/[locale]/dashboard">) {
  const [sp, { t, locale }, viewer, settings] = await Promise.all([searchParams, getI18n(), getViewer(), getPublicSettings()])
  const d = t.dashboard
  const days = sp.days === "7" ? 7 : 30
  if (!viewer && (isSupabaseConfigured || !demoMode)) return <PageShell><SignedOutCard title={d.title} body={d.signInBody} next="/dashboard" /></PageShell>

  const [data, apps] = await Promise.all([getDashboard(days), viewer ? getMakerApps(viewer.id) : Promise.resolve([])])
  const counters = await getMakerCounters(apps.map((a) => a.id), days)
  const totals = data.totals
  const average = totals.averageRating ? new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(totals.averageRating) : "–"
  const tiles: [string, string, string?][] = [
    [d.views, formatNumber(locale, totals.views)], [d.outbound, formatNumber(locale, totals.opens)], [d.saves, formatNumber(locale, totals.favorites)],
    [d.comparisons, formatNumber(locale, counters.comparisons)], [d.followers, formatNumber(locale, counters.followers)],
    [d.installGuides, formatNumber(locale, totals.guidanceViews ?? totals.installActions), d.installGuidesHelp],
    [d.averageRating, average, `${formatNumber(locale, totals.ratings)} ${d.ratings}`], [d.reviews, formatNumber(locale, totals.reviews)],
  ]
  const statusName = d.status as Record<string, string>

  return (
    <PageShell>
      {!viewer && <p className="mb-6 rounded-xl bg-accent px-4 py-2 text-sm text-accent-foreground">{d.demoNote}</p>}
      <PageHeader title={d.title} body={fmt(d.lastDays, { days })}>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link href="/submit" className={cn(buttonVariants(), "rounded-full")}><Plus className="size-4" aria-hidden />{d.submitAnother}</Link>
          {settings.features.requests && <Link href="/dashboard/requests" className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}><Inbox className="size-4" aria-hidden />{d.openRequests}</Link>}
          <nav className="ml-auto inline-flex rounded-full border border-border p-0.5 text-sm" aria-label={d.traffic}>
            {([7, 30] as const).map((n) => <Link key={n} href={`/dashboard?days=${n}`} aria-current={n === days ? "page" : undefined} className={cn("rounded-full px-3 py-1", n === days ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{d.period[String(n) as "7" | "30"]}</Link>)}
          </nav>
        </div>
      </PageHeader>

      <section aria-labelledby="apps-h">
        <h2 id="apps-h" className="mb-3 text-lg font-semibold">{d.myApps}</h2>
        {apps.length ? (
          <ul className="grid gap-3 lg:grid-cols-2">
            {apps.map((a) => (
              <li key={a.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <AppIcon app={a} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/dashboard/apps/${a.slug}`} className="block truncate font-semibold hover:underline">{a.name}</Link>
                    <p className="truncate text-xs text-muted-foreground">{a.domain} · {statusName[a.status] ?? a.status}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <VerificationStatus state={a.verificationState} checkedAt={a.evidenceCheckedAt} t={t.trust} locale={locale} className="px-2 py-0.5 text-[11px]" />
                      <OwnershipBadge status={a.ownershipStatus} t={t.card} showUnverified />
                    </div>
                  </div>
                  <Link href={`/dashboard/apps/${a.slug}`} className={cn(buttonVariants({ size: "sm", variant: "outline" }), "rounded-full")}>{d.manage}</Link>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  {([[d.completeness, a.profileCompleteness], [t.trust.evidenceCompleteness, a.evidenceScore]] as const).map(([label, value]) => (
                    <div key={label}>
                      <div className="flex justify-between text-muted-foreground"><span>{label}</span><span className="tabular-nums">{value} %</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand-gradient" style={{ width: `${value}%` }} /></div>
                    </div>
                  ))}
                </div>
                {a.moderationNote && <p className="mt-3 rounded-xl bg-muted p-2.5 text-xs"><strong>{d.note}:</strong> {a.moderationNote}</p>}
                {a.ownershipStatus !== "verified_owner" && (
                  <Link href={`/apps/${a.slug}/claim`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"><AlertTriangle className="size-3.5" aria-hidden />{d.verifyOwnership}</Link>
                )}
              </li>
            ))}
          </ul>
        ) : <EmptyState title={d.empty}><Link href="/submit" className={cn(buttonVariants(), "rounded-full")}>{d.emptyCta}</Link></EmptyState>}
      </section>

      <section className="mt-10" aria-labelledby="traffic-h">
        <h2 id="traffic-h" className="mb-3 text-lg font-semibold">{d.traffic}</h2>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {tiles.map(([k, v, sub]) => <div key={k} className="rounded-2xl border border-border bg-card p-4"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 text-3xl font-semibold tabular-nums">{v}</dd>{sub && <dd className="mt-1 text-[11px] text-muted-foreground">{sub}</dd>}</div>)}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">{d.trafficNote}</p>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-5 lg:col-span-2"><h2 className="mb-3 font-semibold">{d.trend}</h2><TrendChart data={data.series} locale={locale} labels={{ ...d.chart, empty: d.noActivity }} /></div>
        <div className="rounded-3xl border border-border bg-card p-5"><h2 className="mb-4 font-semibold">{d.trafficSources}</h2><BarList items={data.trafficSources} names={d.sources} locale={locale} empty={d.noData} /></div>
        <div className="rounded-3xl border border-border bg-card p-5 lg:col-span-3"><h2 className="mb-4 font-semibold">{d.topApps}</h2>
          <ol className="divide-y divide-border">
            {data.topApps.map((a, i) => (
              <li key={a.slug} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-5 text-muted-foreground tabular-nums">{i + 1}</span>
                <Link className="flex-1 truncate font-medium hover:underline" href={`/dashboard/apps/${a.slug}`}>{a.name}</Link>
                <span className="tabular-nums text-muted-foreground">{formatNumber(locale, a.views)} {d.views} · {formatNumber(locale, a.opens)} {d.outbound}</span>
              </li>
            ))}
            {!data.topApps.length && <li className="py-4 text-sm text-muted-foreground">{d.noData}</li>}
          </ol>
        </div>
      </section>
    </PageShell>
  )
}
