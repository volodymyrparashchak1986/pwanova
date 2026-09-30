import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PageHeader, PageShell } from "@/components/app/section-header"
import { Link } from "@/components/i18n/link"
import { LaunchCard } from "@/components/launches/launch-card"
import { buttonVariants } from "@/components/ui/button"
import { isLocale } from "@/i18n/config"
import { getDictionary, getI18n } from "@/i18n/server"
import { getLaunches, getPublicSettings } from "@/lib/data/catalog"
import { pageMetadata } from "@/lib/seo"
import { cn } from "@/lib/utils"

export async function generateMetadata({ params }: PageProps<"/[locale]/launches">): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return pageMetadata({ locale, path: "/launches", title: t.launches.title, description: t.launches.metaDescription })
}

export default async function LaunchesPage() {
  const [{ t }, settings] = await Promise.all([getI18n(), getPublicSettings()])
  if (!settings.features.launches) notFound()
  const [current, past] = await Promise.all([getLaunches({ current: true, limit: 40 }), getLaunches({ current: false, limit: 30 })])
  const organic = current.filter((l) => !l.isSponsored)
  const sponsored = current.filter((l) => l.isSponsored)
  return (
    <PageShell>
      <PageHeader title={t.launches.title} body={t.launches.body}>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href="/dashboard" className={cn(buttonVariants({ size: "lg" }), "rounded-full")}>{t.launches.cta}</Link>
          <span className="text-sm text-muted-foreground">{t.launches.ctaBody}</span>
        </div>
      </PageHeader>

      {sponsored.length > 0 && (
        <section className="mb-10 rounded-3xl border border-dashed border-border p-3" aria-label={t.launches.sponsored}>
          <div className="grid gap-4 lg:grid-cols-2">{sponsored.map((l) => <LaunchCard key={l.id} launch={l} />)}</div>
        </section>
      )}

      <section aria-labelledby="current-h">
        <h2 id="current-h" className="mb-4 text-2xl font-semibold tracking-tight">{t.launches.current}</h2>
        {organic.length
          ? <div className="grid gap-4 lg:grid-cols-2">{organic.map((l) => <LaunchCard key={l.id} launch={l} />)}</div>
          : <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">{t.launches.empty}</p>}
        <p className="mt-4 text-xs text-muted-foreground">{t.launches.rankingNote} <Link href="/how-ranking-works" className="font-medium text-brand hover:underline">{t.discover.organicLink}</Link></p>
      </section>

      <section className="mt-12" aria-labelledby="past-h">
        <h2 id="past-h" className="mb-4 text-2xl font-semibold tracking-tight">{t.launches.past}</h2>
        {past.length
          ? <div className="grid gap-4 lg:grid-cols-2">{past.map((l) => <LaunchCard key={l.id} launch={l} />)}</div>
          : <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">{t.launches.emptyPast}</p>}
      </section>

      <section className="mt-12 rounded-3xl border border-border bg-card p-6" aria-labelledby="how-h">
        <h2 id="how-h" className="text-lg font-semibold">{t.launches.howTitle}</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">{t.launches.how.map((s) => <li key={s}>{s}</li>)}</ol>
      </section>
    </PageShell>
  )
}
