import type { Metadata } from "next"
import { Bell, FileCheck2, Megaphone, MessageSquare, Rocket, ShieldCheck, UserCheck } from "lucide-react"
import { EmptyState, PageHeader, PageShell } from "@/components/app/section-header"
import { SignedOutCard } from "@/components/app/signed-out"
import { Link } from "@/components/i18n/link"
import { MarkAllRead } from "@/components/layout/mark-read"
import { isLocale } from "@/i18n/config"
import { fmt, plural, relativeTime } from "@/i18n/format"
import { getDictionary, getI18n } from "@/i18n/server"
import { getViewer } from "@/lib/data"
import { getNotifications, type NotificationItem } from "@/lib/data/account"
import { privateMetadata } from "@/lib/seo"
import { cn } from "@/lib/utils"

export async function generateMetadata({ params }: PageProps<"/[locale]/notifications">): Promise<Metadata> {
  const { locale } = await params
  return privateMetadata(isLocale(locale) ? getDictionary(locale).notifications.title : "Notifications")
}

const ICONS: Record<NotificationItem["kind"], typeof Bell> = {
  app_update: Megaphone, launch: Rocket, claim: ShieldCheck, evidence: FileCheck2, request_match: UserCheck, request_response: MessageSquare,
  contact_shared: UserCheck, moderation: ShieldCheck, system: Bell,
}

export default async function NotificationsPage() {
  const [{ t, locale }, viewer] = await Promise.all([getI18n(), getViewer()])
  if (!viewer) return <PageShell><SignedOutCard title={t.notifications.title} body={t.notifications.signInBody} next="/notifications" /></PageShell>
  const items = await getNotifications(60)
  const unread = items.filter((n) => !n.readAt).length
  const decisions = t.notifications.decisions as Record<string, string>
  return (
    <PageShell className="max-w-2xl">
      <PageHeader title={t.notifications.title} body={t.notifications.inAppOnly}>
        {unread > 0 && <div className="mt-4 flex flex-wrap items-center gap-3"><MarkAllRead label={t.notifications.markAllRead} /><span className="text-sm text-muted-foreground">{plural(locale, unread, t.notifications.newCount)}</span></div>}
      </PageHeader>
      {items.length ? (
        <ul className="space-y-2">
          {items.map((n) => {
            const Icon = ICONS[n.kind] ?? Bell
            const text = fmt(t.notifications.kinds[n.kind] ?? t.notifications.kinds.system, { app: n.appName ?? t.notifications.yourApp, decision: decisions[n.decision ?? ""] ?? n.decision ?? "" })
            const body = (
              <>
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", n.readAt ? "bg-muted text-muted-foreground" : "bg-brand/10 text-brand")}><Icon className="size-4" aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm", !n.readAt && "font-semibold")}>{text}{!n.readAt && <span className="sr-only"> ({t.notifications.unread})</span>}</span>
                  {n.title && <span className="block truncate text-sm text-muted-foreground">{n.title}</span>}
                  <span className="block text-xs text-muted-foreground">{relativeTime(locale, n.createdAt)}</span>
                </span>
              </>
            )
            return (
              <li key={n.id}>
                {n.link
                  ? <Link href={n.link} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-brand/30">{body}</Link>
                  : <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">{body}</div>}
              </li>
            )
          })}
        </ul>
      ) : <EmptyState title={t.notifications.empty} />}
    </PageShell>
  )
}
