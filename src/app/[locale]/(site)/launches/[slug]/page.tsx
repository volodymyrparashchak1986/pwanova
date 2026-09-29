import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft, Bookmark, Eye, MessageSquare, Users } from "lucide-react"
import { AppIcon } from "@/components/app/app-icon"
import { ReportButton } from "@/components/app/report-dialog"
import { PageShell } from "@/components/app/section-header"
import { Link } from "@/components/i18n/link"
import { daysLeft } from "@/components/launches/launch-card"
import { LaunchTracker } from "@/components/launches/launch-tracker"
import { SponsoredLabel, VerificationStatus } from "@/components/trust/trust-signal"
import { buttonVariants } from "@/components/ui/button"
import { isLocale } from "@/i18n/config"
import { fmt, formatDate, formatNumber, plural } from "@/i18n/format"
import { getI18n } from "@/i18n/server"
import { getViewer } from "@/lib/data"
import { getLaunch, getPublicSettings } from "@/lib/data/catalog"
import { pageMetadata } from "@/lib/seo"
import { excerpt } from "@/lib/v2/text"
import { cn } from "@/lib/utils"

type Props = PageProps<"/[locale]/launches/[slug]">

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const launch = await getLaunch(slug)
  if (!launch) return { robots: { index: false, follow: false } }
  const headline = (locale === "de" && launch.headlineDe) || launch.headline
  const body = (locale === "de" && launch.descriptionDe) || launch.description || launch.app.tagline
  return pageMetadata({ locale, path: `/launches/${slug}`, title: `${launch.app.name}: ${headline}`, description: excerpt(body), index: !launch.app.isDemo })
}

export default async function LaunchPage({ params }: Props) {
  const [{ slug }, { t, locale }, viewer, settings] = await Promise.all([params, getI18n(), getViewer(), getPublicSettings()])
  if (!settings.features.launches) notFound()
  const launch = await getLaunch(slug)
  if (!launch) notFound()
  const headline = (locale === "de" && launch.headlineDe) || launch.headline
  const body = (locale === "de" && launch.descriptionDe) || launch.description
  const left = launch.inWindow ? daysLeft(launch.windowEnd) : null
  const signals = [[Bookmark, t.launches.signals.saves, launch.signals.saves], [Users, t.launches.signals.follows, launch.signals.follows], [MessageSquare, t.launches.signals.reviews, launch.signals.reviews], [Eye, t.launches.signals.visitors, launch.signals.visitors]] as const
  return (
    <PageShell className="max-w-3xl">
      <LaunchTracker appId={launch.app.id} />
      <Link href="/launches" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />{t.launches.title}</Link>
      <header className="mt-5 flex items-start gap-5">
        <AppIcon app={launch.app} size="lg" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {launch.isSponsored && <SponsoredLabel label={t.card.sponsored} help={t.card.sponsoredHelp} />}
            <span>{launch.app.name}</span>
            {launch.maker.name && <span>· {fmt(t.launches.launchedBy, { name: launch.maker.name })}</span>}
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance md:text-4xl">{headline}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {launch.windowStart && launch.windowEnd && fmt(t.launches.windowFromTo, { from: formatDate(locale, launch.windowStart), to: formatDate(locale, launch.windowEnd) })}
            {left !== null && <> · {plural(locale, left, t.launches.daysLeft)}</>}
          </p>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link href={`/apps/${launch.app.slug}?from=launch`} className={cn(buttonVariants({ size: "lg" }), "rounded-full")}>{t.launches.viewApp}</Link>
        <VerificationStatus state={launch.app.verificationState} t={t.trust} locale={locale} />
      </div>

      <section className="mt-8 rounded-3xl border border-border bg-card p-5 md:p-6" aria-labelledby="about-h">
        <h2 id="about-h" className="text-lg font-semibold">{t.launches.about}</h2>
        <p className="mt-2 text-[16px] leading-relaxed whitespace-pre-line text-foreground/90">{body || launch.app.tagline}</p>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={t.launches.rankingNote}>
        {signals.map(([Icon, label, n]) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4 text-center">
            <Icon className="mx-auto size-4 text-muted-foreground" aria-hidden />
            <p className="mt-1 text-xl font-semibold tabular-nums">{formatNumber(locale, n)}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </section>
      <p className="mt-3 text-xs text-muted-foreground">{t.launches.rankingNote}</p>
      <p className="mt-6"><ReportButton target={{ launchId: launch.id }} kind="app" title={fmt(t.report.titleApp, { name: launch.app.name })} label={t.reviews.report} signedIn={Boolean(viewer)} next={`/launches/${launch.slug}`} /></p>
    </PageShell>
  )
}
