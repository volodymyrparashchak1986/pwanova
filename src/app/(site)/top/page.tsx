import type { Metadata } from "next"
import { AppRow } from "@/components/app/app-card"
import { PageShell } from "@/components/app/section-header"
import { getApps } from "@/lib/data"

export const metadata: Metadata = { title: "Top apps", description: "The highest-ranked web apps on PWANova, ranked by rating confidence, reviews, saves, opens and quality checks." }

export default async function TopPage() {
  const apps = await getApps({ sort: "top", limit: 50 })
  return (
    <PageShell className="max-w-3xl">
      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Top Apps</h1>
      <p className="mt-2 text-muted-foreground">
        Ranked by a confidence-weighted rating plus reviews, saves, opens, recent activity and quality checks. One perfect rating can&apos;t buy the #1 spot.
      </p>
      <div className="mt-8 divide-y divide-border">{apps.map((a, i) => <AppRow key={a.id} app={a} rank={i + 1} />)}</div>
    </PageShell>
  )
}
