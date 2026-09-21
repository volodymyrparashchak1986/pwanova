import type { Metadata } from "next"
import { AppCard } from "@/components/app/app-card"
import { PageShell } from "@/components/app/section-header"
import { getApps } from "@/lib/data"

export const metadata: Metadata = { title: "New & Rising", description: "Recently listed web apps worth a look." }

export default async function NewPage() {
  const apps = await getApps({ sort: "new", limit: 30 })
  return (
    <PageShell>
      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">New &amp; Rising</h1>
      <p className="mt-2 text-muted-foreground">Fresh launches. Be one of their first ratings.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{apps.map((a) => <AppCard key={a.id} app={a} />)}</div>
    </PageShell>
  )
}
