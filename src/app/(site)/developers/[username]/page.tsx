import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { BadgeCheck, Globe } from "lucide-react"
import { AppCard } from "@/components/app/app-card"
import { PageShell } from "@/components/app/section-header"
import { Stars } from "@/components/app/stars"
import { getApps, getDeveloper } from "@/lib/data"
import { formatCount } from "@/lib/format"
import { siteUrl } from "@/lib/env"
import { jsonLd } from "@/lib/security/sanitize"

type Props = { params: Promise<{ username: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dev = await getDeveloper((await params).username)
  if (!dev) return { title: "Developer not found" }
  return {
    title: `${dev.displayName} — apps on PWANova`,
    description: dev.bio ?? `Web apps by ${dev.displayName} on PWANova.`,
    alternates: { canonical: `/developers/${dev.username}` },
    robots: dev.isDemo ? { index: false } : undefined,
  }
}

export default async function DeveloperPage({ params }: Props) {
  const dev = await getDeveloper((await params).username)
  if (!dev) notFound()
  const apps = await getApps({ developerId: dev.id, sort: "top" })
  const totalRatings = apps.reduce((s, a) => s + a.ratingsCount, 0)
  const avg = totalRatings ? apps.reduce((s, a) => s + a.rating * a.ratingsCount, 0) / totalRatings : 0
  const opens = apps.reduce((s, a) => s + a.opens30d, 0)
  const ld = { "@context": "https://schema.org", "@type": "Person", name: dev.displayName, url: `${siteUrl}/developers/${dev.username}`, ...(dev.website && { sameAs: [dev.website] }), ...(dev.bio && { description: dev.bio }) }

  return (
    <PageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <header className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-left">
        <span className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient text-3xl font-semibold text-white">
          {dev.avatarUrl
            // eslint-disable-next-line @next/next/no-img-element -- remote avatar
            ? <img src={`/api/media?url=${encodeURIComponent(dev.avatarUrl)}`} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
            : dev.displayName.slice(0, 1)}
        </span>
        <div>
          <h1 className="flex items-center justify-center gap-2 text-3xl font-semibold tracking-tight sm:justify-start md:text-4xl">{dev.displayName}{dev.isVerified && <BadgeCheck className="size-6 text-brand" aria-label="Verified developer" />}</h1>
          <p className="text-sm text-muted-foreground">@{dev.username}</p>
          {dev.bio && <p className="mt-3 max-w-xl text-muted-foreground">{dev.bio}</p>}
          {dev.website && <a href={dev.website} rel="noopener noreferrer nofollow" target="_blank" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"><Globe className="size-4" />{dev.website.replace(/^https?:\/\//, "")}</a>}
        </div>
      </header>

      <dl className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Apps", String(apps.length)],
          ["Average rating", avg ? avg.toFixed(2) : "–"],
          ["Total ratings", formatCount(totalRatings)],
          ["App opens · 30d", formatCount(opens)],
          ["Followers", "Soon"],
        ].map(([k, v]) => <div key={k} className="rounded-2xl border border-border bg-card p-4"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums">{v}{k === "Average rating" && avg > 0 && <Stars value={avg} size={12} />}</dd></div>)}
      </dl>

      <h2 className="mt-12 mb-5 text-2xl font-semibold tracking-tight">Apps</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{apps.map((a) => <AppCard key={a.id} app={a} />)}</div>
    </PageShell>
  )
}
