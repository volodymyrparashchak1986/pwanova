import type { Metadata } from "next"
import Link from "next/link"
import { Bookmark, CornerDownRight, MessageSquare } from "lucide-react"
import { EmptyState, PageShell } from "@/components/app/section-header"
import { SignedOutCard } from "@/components/app/signed-out"
import { Stars } from "@/components/app/stars"
import { getActivity, getViewer } from "@/lib/data"
import { timeAgo } from "@/lib/format"

export const metadata: Metadata = { title: "Activity", robots: { index: false } }

export default async function ActivityPage() {
  const viewer = await getViewer()
  if (!viewer) return <PageShell><SignedOutCard title="Your activity" body="Sign in to see your reviews, developer replies and saved apps." next="/activity" /></PageShell>
  const { reviews, favorites } = await getActivity(viewer.id)
  const empty = !reviews.length && !favorites.length
  return (
    <PageShell className="max-w-2xl">
      <h1 className="text-4xl font-semibold tracking-tight">Activity</h1>
      {empty && <div className="mt-8"><EmptyState title="No activity yet" body="Rate an app, write a review or save one you like." /></div>}
      {reviews.length > 0 && <section className="mt-8"><h2 className="mb-3 text-lg font-semibold">Your reviews</h2>
        <ul className="space-y-3">{reviews.map((r) => {
          const resp = Array.isArray(r.response) ? r.response[0] : r.response
          return <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm"><MessageSquare className="size-4 text-muted-foreground" /><Link href={`/apps/${r.app?.slug}`} className="font-semibold hover:underline">{r.app?.name}</Link><span className="text-muted-foreground">{timeAgo(r.created_at)}</span></p>
            <Stars value={r.rating} size={13} className="mt-2" />
            <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">{r.body}</p>
            {resp && <p className="mt-3 flex gap-1.5 rounded-xl bg-accent/60 p-3 text-sm"><CornerDownRight className="mt-0.5 size-4 shrink-0" /><span><strong>Developer replied:</strong> {resp.body}</span></p>}
          </li>
        })}</ul></section>}
      {favorites.length > 0 && <section className="mt-8"><h2 className="mb-3 text-lg font-semibold">Recently saved</h2>
        <ul className="space-y-2">{favorites.map((f, i) => <li key={i} className="flex items-center gap-2 text-sm"><Bookmark className="size-4 text-muted-foreground" /><Link href={`/apps/${f.app?.slug}`} className="font-medium hover:underline">{f.app?.name}</Link><span className="text-muted-foreground">{timeAgo(f.created_at)}</span></li>)}</ul></section>}
    </PageShell>
  )
}
