import type { Metadata } from "next"
import { Suspense } from "react"
import { AppCard } from "@/components/app/app-card"
import { ExploreFilters } from "@/components/app/explore-filters"
import { EmptyState, PageShell } from "@/components/app/section-header"
import { getApps } from "@/lib/data"
import { filtersFromParams } from "@/lib/search-params"

export const metadata: Metadata = {
  title: "Explore apps",
  description: "Search and filter modern web apps by category, rating, verification, build tool, hosting and launch source.",
}

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const filters = filtersFromParams(sp)
  const apps = await getApps({ ...filters, limit: 60 })
  const from = filters.q ? "search" : undefined
  return (
    <PageShell>
      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Explore</h1>
      <p className="mt-2 text-muted-foreground">Find web apps you can trust, then install them to your home screen.</p>
      <div className="mt-7"><Suspense><ExploreFilters autoFocus={sp.focus === "1"} /></Suspense></div>
      <p className="mt-6 mb-4 text-sm text-muted-foreground" aria-live="polite">{apps.length} {apps.length === 1 ? "app" : "apps"}{filters.q ? ` for “${filters.q}”` : ""}</p>
      {apps.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{apps.map((a) => <AppCard key={a.id} app={a} from={from} />)}</div>
      ) : (
        <EmptyState title="No apps match those filters" body="Try removing a filter or searching for something broader." />
      )}
    </PageShell>
  )
}
