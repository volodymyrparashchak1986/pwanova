import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Clock, ShieldCheck } from "lucide-react"
import { AppIcon } from "@/components/app/app-icon"
import { ClaimPanel } from "@/components/app/claim-panel"
import { PageShell } from "@/components/app/section-header"
import { buttonVariants } from "@/components/ui/button"
import { getAppBySlug, getOwnedAppBySlug, getViewer } from "@/lib/data"
import { isSupabaseConfigured } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"
import { claimInstructions } from "@/lib/verification"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Claim this app", robots: { index: false } }

export default async function ClaimPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const viewer = await getViewer()

  // Public listing first; owners can also reach the claim page of their own app while it is still pending review.
  const published = await getAppBySlug(slug)
  const owned = !published && viewer ? await getOwnedAppBySlug(slug, viewer.id) : null
  const app = published
    ? { id: published.id, slug: published.slug, name: published.name, domain: published.domain, iconUrl: published.iconUrl, ownershipStatus: published.ownershipStatus, ownerId: published.developer.id, status: "published" as string }
    : owned
  if (!app) notFound()

  let token: string | null = null
  if (viewer) {
    const sb = await createClient()
    const { data } = await sb.from("app_claims").select("token").eq("app_id", app.id).eq("user_id", viewer.id).maybeSingle()
    token = data?.token ?? null
  }
  const mine = viewer && app.ownerId === viewer.id && app.ownershipStatus === "verified_owner"
  const isPublic = app.status === "published"

  return (
    <PageShell className="max-w-2xl">
      <div className="flex items-center gap-4"><AppIcon app={app} size="md" /><div><p className="text-sm text-muted-foreground">Claim</p><h1 className="text-3xl font-semibold tracking-tight">{app.name}</h1></div></div>

      {!isPublic && (
        <p className="mt-6 flex items-start gap-2 rounded-2xl bg-accent/60 p-4 text-sm"><Clock className="mt-0.5 size-4 shrink-0" />
          <span>This listing is <strong>{app.status}</strong>: it becomes public after a moderator approves it. You can verify ownership now.</span></p>
      )}

      <div className="mt-8 rounded-3xl border border-border bg-card p-6">
        {app.ownershipStatus === "verified_owner" ? (
          <div className="flex items-start gap-3"><ShieldCheck className="size-6 text-ok" />
            <div><p className="font-semibold">{mine ? "You're the verified owner." : "This app already has a verified owner."}</p>
              <p className="mt-1 text-sm text-muted-foreground">{mine ? "You can respond to reviews and see analytics on your dashboard." : "If you believe this is a mistake, report the listing from its page."}</p></div></div>
        ) : !isSupabaseConfigured ? (
          <p className="text-muted-foreground">Ownership claims need a connected Supabase project. See the README for setup.</p>
        ) : !viewer ? (
          <div><p className="text-muted-foreground">Sign in to claim <strong>{app.name}</strong> and prove you control <strong>{app.domain}</strong>.</p>
            <Link href={`/sign-in?next=/apps/${app.slug}/claim`} className={cn(buttonVariants({ size: "lg" }), "mt-5 rounded-full")}>Sign in to claim</Link></div>
        ) : (
          <div className="space-y-5">
            <div><h2 className="text-lg font-semibold">Prove you own {app.domain}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Choose one method. Once verified you become the verified owner and PWANova runs its quality checks for the PWANova Verified badge.</p></div>
            <ClaimPanel appId={app.id} hasClaim={Boolean(token)} instructions={token ? claimInstructions(token, app.domain) : null} />
          </div>
        )}
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        {isPublic ? <Link className="hover:underline" href={`/apps/${app.slug}`}>← Back to {app.name}</Link> : <Link className="hover:underline" href="/dashboard">← Back to dashboard</Link>}
      </p>
    </PageShell>
  )
}
