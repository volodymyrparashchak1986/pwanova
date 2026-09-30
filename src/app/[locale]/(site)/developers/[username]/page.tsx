import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Globe } from "lucide-react"
import { PageShell } from "@/components/app/section-header"
import { Stars } from "@/components/app/stars"
import { AppCard } from "@/components/catalog/app-card"
import { isLocale } from "@/i18n/config"
import { fmt, formatNumber } from "@/i18n/format"
import { getDictionary, getI18n } from "@/i18n/server"
import { getDeveloper, getViewer } from "@/lib/data"
import { getSavedIds } from "@/lib/data/account"
import { getPublicSettings, searchCatalog } from "@/lib/data/catalog"
import { siteUrl } from "@/lib/env"
import { jsonLd } from "@/lib/security/sanitize"
import { pageMetadata } from "@/lib/seo"

type Props = PageProps<"/[locale]/developers/[username]">

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, username } = await params
  if (!isLocale(locale)) return {}
  const dev = await getDeveloper(username)
  if (!dev) return { robots: { index: false, follow: false } }
  const t = getDictionary(locale)
  return pageMetadata({
    locale, path: `/developers/${dev.username}`, title: fmt(t.developer.metaTitle, { name: dev.displayName }),
    description: dev.bio ?? fmt(t.developer.metaDescription, { name: dev.displayName }), index: !dev.isDemo,
  })
}

export default async function DeveloperPage({ params }: Props) {
  const [{ username }, { t, locale }, viewer, settings] = await Promise.all([params, getI18n(), getViewer(), getPublicSettings()])
  const dev = await getDeveloper(username)
  if (!dev) notFound()
  const [{ apps }, saved] = await Promise.all([searchCatalog({ filters: { developerId: dev.id }, sort: "rating", pageSize: 48 }), getSavedIds(viewer?.id ?? null)])
  const totalRatings = apps.reduce((s, a) => s + a.ratingsCount, 0)
  const average = totalRatings ? apps.reduce((s, a) => s + a.rating * a.ratingsCount, 0) / totalRatings : 0
  const visits = apps.reduce((s, a) => s + a.opens30d, 0)
  const verified = apps.filter((a) => a.ownershipStatus === "verified_owner").length
  const ld = dev.isDemo ? null : { "@context": "https://schema.org", "@type": "Person", name: dev.displayName, url: `${siteUrl}/${locale}/developers/${dev.username}`, ...(dev.website && { sameAs: [dev.website] }), ...(dev.bio && { description: dev.bio }) }
  const stats: [string, string][] = [
    [t.developer.apps, formatNumber(locale, apps.length)],
    [t.developer.averageRating, average ? new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(average) : "–"],
    [t.developer.ratings, formatNumber(locale, totalRatings)],
    [t.developer.visits, formatNumber(locale, visits)],
  ]
  return (
    <PageShell>
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />}
      <header className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-left">
        <span className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient text-3xl font-semibold text-white">
          {dev.avatarUrl
            // eslint-disable-next-line @next/next/no-img-element -- remote avatar through the raster proxy
            ? <img src={`/api/media?url=${encodeURIComponent(dev.avatarUrl)}`} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
            : dev.displayName.slice(0, 1)}
        </span>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{dev.displayName}</h1>
          <p className="text-sm text-muted-foreground">@{dev.username}</p>
          {dev.bio && <p className="mt-3 max-w-xl text-muted-foreground">{dev.bio}</p>}
          {dev.website && /^https?:\/\//i.test(dev.website) && (
            <a href={dev.website} rel="noopener noreferrer nofollow ugc" target="_blank" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"><Globe className="size-4" aria-hidden />{dev.website.replace(/^https?:\/\//, "")}</a>
          )}
          {verified > 0 && <p className="mt-2 text-xs text-muted-foreground">{fmt(t.developer.verifiedOwner, { count: verified })}</p>}
        </div>
      </header>

      <dl className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([k, v], i) => (
          <div key={k} className="rounded-2xl border border-border bg-card p-4">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums">{v}{i === 1 && average > 0 && <Stars value={average} size={12} label={fmt(t.common.starsOf, { value: average.toFixed(1) })} />}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-12 mb-5 text-2xl font-semibold tracking-tight">{t.developer.apps}</h2>
      {apps.length
        ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{apps.map((a) => <AppCard key={a.id} app={a} signedIn={Boolean(viewer)} saved={saved.has(a.id)} compareEnabled={settings.features.compare} />)}</div>
        : <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">{t.developer.noApps}</p>}
    </PageShell>
  )
}
