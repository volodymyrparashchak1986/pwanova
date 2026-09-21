import type { Metadata } from "next"
import Link from "next/link"
import { AppCard } from "@/components/app/app-card"
import { EmptyState, PageShell } from "@/components/app/section-header"
import { SignedOutCard } from "@/components/app/signed-out"
import { buttonVariants } from "@/components/ui/button"
import { getSavedApps, getViewer } from "@/lib/data"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Saved apps", robots: { index: false } }

export default async function SavedPage() {
  const viewer = await getViewer()
  if (!viewer) return <PageShell><SignedOutCard title="Saved apps" body="Sign in to keep a list of apps you want to come back to." next="/saved" /></PageShell>
  const apps = await getSavedApps(viewer.id)
  return (
    <PageShell>
      <h1 className="text-4xl font-semibold tracking-tight">Saved</h1>
      <div className="mt-8">
        {apps.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{apps.map((a) => <AppCard key={a.id} app={a} />)}</div>
          : <EmptyState title="Nothing saved yet" body="Tap Save on any app and it will show up here."><Link href="/explore" className={cn(buttonVariants(), "rounded-full")}>Explore apps</Link></EmptyState>}
      </div>
    </PageShell>
  )
}
