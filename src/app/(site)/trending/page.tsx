import type { Metadata } from "next"
import { AppRow } from "@/components/app/app-card"
import { PageShell } from "@/components/app/section-header"
import { getApps } from "@/lib/data"

export const metadata: Metadata = { title: "Trending apps", description: "Web apps gaining momentum this week." }

export default async function TrendingPage() {
  const apps = await getApps({ sort: "trending", limit: 30 })
  return (
    <PageShell className="max-w-3xl">
      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Trending</h1>
      <p className="mt-2 text-muted-foreground">Momentum over the last 7 days: opens, saves, reviews and new ratings.</p>
      <div className="mt-8 divide-y divide-border">{apps.map((a, i) => <AppRow key={a.id} app={a} rank={i + 1} from="home" />)}</div>
    </PageShell>
  )
}
