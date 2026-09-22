import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Clock, MessageSquareWarning, ShieldCheck } from "lucide-react"
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

const STATUS_COPY: Record<string, string> = {
  pending: "This listing is awaiting moderation. It becomes public once approved. You can verify ownership now.",
  rejected: "This submission was not approved.",
  suspended: "This app is currently suspended.",
}

export default async function ClaimPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const viewer = await getViewer()

  // Public listing first; owners can also reach the claim page of their own app while it is awaiting
  // moderation, was rejected, or is suspended (getOwnedAppBySlug is scoped to developer_id = viewer.id).
  const published = await getAppBySlug(slug)
  const owned = !published && viewer ? await getOwnedAppBySlug(slug, viewer.id) : null
  const app = published
    ? { url: published.url, id: published.id, slug: published.slug, name: published.name, domain: published.domain, iconUrl: published.iconUrl, ownershipStatus: published.ownershipStatus, ownerId: published.developer.id, status: "published" as string, moderationNote: null as string | null }
    : owned
  if (!app) notFound()

  let token: string | null = null
  let expiresAt: string | null = null
  if (viewer) {
    const sb = await createClient()
    const { data } = await sb.from("app_claims").select("token, expires_at").eq("app_id", app.id).eq("user_id", viewer.id).maybeSingle()
    token = data?.token ?? null
    expiresAt = data?.expires_at ?? null
  }
  const mine = viewer && app.ownerId === viewer.id && app.ownershipStatus === "verified_owner"
  const isPublic = app.status === "published"

  return (
    <PageShell className="max-w-2xl">
      <div className="flex items-center gap-4"><AppIcon app={app} size="md" /><div><p className="text-sm text-muted-foreground">Claim</p><h1 className="text-3xl font-semibold tracking-tight">{app.name}</h1></div></div>

      {!isPublic && (
        <p className="mt-6 flex items-start gap-2 rounded-2xl bg-accent/60 p-4 text-sm"><Clock className="mt-0.5 size-4 shrink-0" />
          <span><strong className="capitalize">{app.status}.</strong> {STATUS_COPY[app.status] ?? "This listing is not public yet."}</span></p>
      )}
      {app.moderationNote && (
        <p className="mt-3 flex items-start gap-2 rounded-2xl border border-border bg-card p-4 text-sm">
          <MessageSquareWarning className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span><strong>Moderator note:</strong> {app.moderationNote}</span></p>
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
              <p className="mt-1 text-sm text-muted-foreground">Publish the verification file on the exact app origin. Ownership verification and publication approval are separate. Technical observations are not a security audit.</p></div>
            <ClaimPanel appId={app.id} hasClaim={Boolean(token)} instructions={token ? claimInstructions(token, app.url) : null} expiresAt={expiresAt} />
          </div>
        )}
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        {isPublic ? <Link className="hover:underline" href={`/apps/${app.slug}`}>← Back to {app.name}</Link> : <Link className="hover:underline" href="/dashboard">← Back to dashboard</Link>}
      </p>
    </PageShell>
  )
}
