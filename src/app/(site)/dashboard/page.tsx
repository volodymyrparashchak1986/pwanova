import type { Metadata } from "next"
import Link from "next/link"
import { AlertTriangle, Plus, ShieldCheck } from "lucide-react"
import { AppIcon } from "@/components/app/app-icon"
import { BarList, TrendChart } from "@/components/app/charts"
import { PageShell, EmptyState } from "@/components/app/section-header"
import { buttonVariants } from "@/components/ui/button"
import { getDashboard, getMyApps, getViewer } from "@/lib/data"
import { isSupabaseConfigured } from "@/lib/env"
import { formatCount } from "@/lib/format"
import { SignedOutCard } from "@/components/app/signed-out"
import { demo } from "@/lib/data/demo"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Developer dashboard", robots: { index: false } }

export default async function DashboardPage() {
  const viewer = await getViewer()
  if (!viewer && isSupabaseConfigured) return <PageShell><SignedOutCard title="Developer dashboard" body="Sign in to see how your apps are performing." next="/dashboard" /></PageShell>

  const data = await getDashboard()
  const apps = viewer
    ? await getMyApps(viewer.id)
    : demo().apps.filter((a) => a.developer.username === "novalabs").map((a) => ({ id: a.id, slug: a.slug, name: a.name, domain: a.domain, url: a.url, iconUrl: null, status: a.status, ownershipStatus: a.ownershipStatus, verificationStatus: a.verificationStatus, category: a.category, moderationNote: null }))
  const t = data.totals
  const tiles: [string, string, string?][] = [
    ["Views", formatCount(t.views)], ["Opens", formatCount(t.opens)], ["Install actions", formatCount(t.installActions), "Clicks on Install. Not confirmed installs."],
    ["Favorites", formatCount(t.favorites)], ["Rating", t.averageRating ? t.averageRating.toFixed(1) : "–", `${formatCount(t.ratings)} ratings`], ["Reviews", formatCount(t.reviews)],
  ]

  return (
    <PageShell>
      {!viewer && <p className="mb-6 rounded-xl bg-accent px-4 py-2 text-sm text-accent-foreground">Demo mode: showing sample analytics for the demo developer “Nova Labs”.</p>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-4xl font-semibold tracking-tight">Dashboard</h1><p className="mt-1 text-muted-foreground">Last 14 days across your apps.</p></div>
        <Link href="/ship" className={cn(buttonVariants(), "rounded-full")}><Plus className="size-4" />Ship an app</Link>
      </div>

      <section className="mt-8"><h2 className="mb-3 text-lg font-semibold">My Apps</h2>
        {apps.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {apps.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
                <AppIcon app={a} size="sm" />
                <div className="min-w-0 flex-1"><Link href={a.status === "published" ? `/apps/${a.slug}` : `/apps/${a.slug}/claim`} className="block truncate font-semibold hover:underline">{a.name}</Link>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground"><span className="capitalize">{a.status}</span>
                    {a.verificationStatus === "verified" ? <span className="inline-flex items-center gap-1 text-brand"><ShieldCheck className="size-3" />Verified</span> : null}</p>
                  {a.moderationNote && <p className="mt-0.5 truncate text-xs text-muted-foreground">Note: {a.moderationNote}</p>}</div>
                {a.ownershipStatus !== "verified_owner" && <Link href={`/apps/${a.slug}/claim`} className={cn(buttonVariants({ size: "sm", variant: "outline" }), "rounded-full")}><AlertTriangle className="size-3.5" />Verify ownership</Link>}
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No apps yet" body="Ship your first app to start collecting ratings, reviews and analytics."><Link href="/ship" className={cn(buttonVariants(), "rounded-full")}>Ship Your App</Link></EmptyState>}
      </section>

      <section className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {tiles.map(([k, v, sub]) => <div key={k} className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-1 text-3xl font-semibold tabular-nums">{v}</p>{sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}</div>)}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-5 lg:col-span-2"><h2 className="mb-3 font-semibold">Trend</h2><TrendChart data={data.series} /></div>
        <div className="rounded-3xl border border-border bg-card p-5"><h2 className="mb-4 font-semibold">Traffic sources</h2><BarList items={data.trafficSources} labels /></div>
        <div className="rounded-3xl border border-border bg-card p-5"><h2 className="mb-4 font-semibold">Launch sources</h2><BarList items={data.launchSources} /></div>
        <div className="rounded-3xl border border-border bg-card p-5 lg:col-span-2"><h2 className="mb-4 font-semibold">Top apps</h2>
          <ol className="divide-y divide-border">{data.topApps.map((a, i) => <li key={a.slug} className="flex items-center gap-3 py-2.5 text-sm"><span className="w-5 text-muted-foreground tabular-nums">{i + 1}</span><Link className="flex-1 truncate font-medium hover:underline" href={`/apps/${a.slug}`}>{a.name}</Link><span className="tabular-nums text-muted-foreground">{formatCount(a.views)} views · {formatCount(a.opens)} opens</span></li>)}
            {!data.topApps.length && <li className="py-4 text-sm text-muted-foreground">Nothing yet.</li>}</ol></div>
      </section>
    </PageShell>
  )
}
