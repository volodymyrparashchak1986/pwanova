import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft, Clock, MessageSquareWarning, ShieldCheck } from "lucide-react"
import { AppIcon } from "@/components/app/app-icon"
import { ClaimPanel } from "@/components/app/claim-panel"
import { PageShell } from "@/components/app/section-header"
import { Link } from "@/components/i18n/link"
import { buttonVariants } from "@/components/ui/button"
import { isLocale } from "@/i18n/config"
import { I18nScope } from "@/i18n/scope"
import { fmt } from "@/i18n/format"
import { getDictionary, getI18n } from "@/i18n/server"
import { getOwnedAppBySlug, getViewer } from "@/lib/data"
import { getAppDetail } from "@/lib/data/catalog"
import { isSupabaseConfigured } from "@/lib/env"
import { privateMetadata } from "@/lib/seo"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

type Props = PageProps<"/[locale]/apps/[slug]/claim">

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return privateMetadata(isLocale(locale) ? getDictionary(locale).app.claimCta : "Claim")
}

export default async function ClaimPage({ params }: Props) {
  const [{ slug }, { t, href }, viewer] = await Promise.all([params, getI18n(), getViewer()])

  // The public listing first. An owner also reaches the claim page of their own app while it waits for
  // review, was rejected or is suspended (getOwnedAppBySlug only returns rows of the signed-in person).
  const published = (await getAppDetail(slug))?.app
  const owned = !published && viewer ? await getOwnedAppBySlug(slug, viewer.id) : null
  const app = published
    ? { url: published.url, id: published.id, slug: published.slug, name: published.name, domain: published.domain, iconUrl: published.iconUrl, ownershipStatus: published.ownershipStatus, ownerId: published.developer.id, status: "published", moderationNote: null as string | null }
    : owned
  if (!app) notFound()

  let token: string | null = null
  let expiresAt: string | null = null
  if (viewer && isSupabaseConfigured) {
    const sb = await createClient()
    const { data } = await sb.from("app_claims").select("token, expires_at, status").eq("app_id", app.id).eq("user_id", viewer.id).maybeSingle()
    if (data && data.status === "pending") { token = data.token; expiresAt = data.expires_at }
  }
  const mine = Boolean(viewer && app.ownerId === viewer.id && app.ownershipStatus === "verified_owner")
  const isPublic = app.status === "published"
  const statusCopy: Record<string, string> = { pending: t.claim.statusPending, rejected: t.claim.statusRejected, suspended: t.claim.statusSuspended, hidden: t.claim.statusHidden }
  let fileUrl: string | null = null
  try { fileUrl = `${new URL(app.url).origin}/.well-known/pwanova-verification.txt` } catch { /* an invalid stored URL cannot be claimed */ }

  return (
    <PageShell className="max-w-2xl">
      <div className="flex items-center gap-4"><AppIcon app={app} size="md" /><div><p className="text-sm text-muted-foreground">{t.claim.eyebrow}</p><h1 className="text-3xl font-semibold tracking-tight">{app.name}</h1></div></div>

      {!isPublic && <p className="mt-6 flex items-start gap-2 rounded-2xl bg-accent/60 p-4 text-sm"><Clock className="mt-0.5 size-4 shrink-0" aria-hidden /><span>{statusCopy[app.status] ?? t.app.unpublished}</span></p>}
      {app.moderationNote && (
        <p className="mt-3 flex items-start gap-2 rounded-2xl border border-border bg-card p-4 text-sm">
          <MessageSquareWarning className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span><strong>{t.claim.moderatorNote}:</strong> {app.moderationNote}</span>
        </p>
      )}

      <div className="mt-8 rounded-3xl border border-border bg-card p-6">
        {app.ownershipStatus === "verified_owner" ? (
          <div className="flex items-start gap-3"><ShieldCheck className="size-6 shrink-0 text-ok" aria-hidden />
            <div><p className="font-semibold">{mine ? t.claim.youAreOwner : t.claim.alreadyOwned}</p>
              <p className="mt-1 text-sm text-muted-foreground">{mine ? t.claim.youAreOwnerBody : t.claim.otherOwnerBody}</p></div></div>
        ) : !isSupabaseConfigured ? (
          <p className="text-muted-foreground">{t.claim.needsDatabase}</p>
        ) : !viewer ? (
          <div><p className="text-muted-foreground">{fmt(t.claim.signInBody, { name: app.name, domain: app.domain })}</p>
            <Link href={`/sign-in?next=${encodeURIComponent(href(`/apps/${app.slug}/claim`))}`} className={cn(buttonVariants({ size: "lg" }), "mt-5 rounded-full")}>{t.claim.signInCta}</Link></div>
        ) : (
          <div className="space-y-5">
            <div><h2 className="text-lg font-semibold">{fmt(t.claim.proveTitle, { domain: app.domain })}</h2><p className="mt-1 text-sm text-muted-foreground">{t.claim.proveBody}</p></div>
            <I18nScope namespaces={["claim"]}><ClaimPanel appId={app.id} token={token} fileUrl={fileUrl} expiresAt={expiresAt} /></I18nScope>
          </div>
        )}
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link className="inline-flex items-center gap-1 hover:underline" href={isPublic ? `/apps/${app.slug}` : "/dashboard"}><ArrowLeft className="size-4" aria-hidden />{isPublic ? fmt(t.app.backToApp, { name: app.name }) : t.claim.backToDashboard}</Link>
      </p>
    </PageShell>
  )
}
