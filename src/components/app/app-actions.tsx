"use client"

import { useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { Download, ExternalLink, Flag, Share2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { FollowButton, SaveButton } from "@/components/catalog/save-button"
import { CompareButton } from "@/components/compare/compare-button"
import { InstallDialog } from "./install-dialog"
import { ReportDialog } from "./report-dialog"
import { useI18n } from "@/i18n/client"
import { fmt } from "@/i18n/format"
import { track } from "@/lib/track"

const subscribeHash = (callback: () => void) => {
  window.addEventListener("hashchange", callback)
  return () => window.removeEventListener("hashchange", callback)
}

export function AppActions({ app, signedIn, saved, following, from, compareEnabled = true }: {
  app: { id: string; name: string; slug: string; iconUrl: string | null; url: string; isPwa: boolean; isDemo: boolean }
  signedIn: boolean; saved: boolean; following: boolean; from?: string; compareEnabled?: boolean
}) {
  const { t, href } = useI18n()
  const hash = useSyncExternalStore(subscribeHash, () => location.hash, () => "")
  const router = useRouter()
  const [installOpen, setInstallOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const profile = href(`/apps/${app.slug}`)

  const onShare = async () => {
    const url = `${location.origin}${profile}`
    track(app.id, "share", from)
    try {
      if (navigator.share) await navigator.share({ title: app.name, url })
      else { await navigator.clipboard.writeText(url); toast.success(t.common.linkCopied) }
    } catch { /* the visitor closed the share sheet */ }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="lg" className="rounded-full" nativeButton={false}
        render={<a href={app.url} target="_blank" rel="noopener noreferrer" title={app.isDemo ? t.card.demoSite : undefined} onClick={() => track(app.id, "open_app", from)} />}>
        {t.app.visit} <ExternalLink className="size-4" />
      </Button>
      <SaveButton appId={app.id} slug={app.slug} name={app.name} active={saved} signedIn={signedIn} variant="full" />
      {compareEnabled && <CompareButton app={{ id: app.id, slug: app.slug, name: app.name, iconUrl: app.iconUrl }} variant="full" />}
      <FollowButton appId={app.id} slug={app.slug} name={app.name} active={following} signedIn={signedIn} />
      {app.isPwa && (
        <Button size="lg" variant="secondary" className="rounded-full" onClick={() => { track(app.id, "install_click", from); setInstallOpen(true) }}>
          <Download className="size-4" />{t.app.install}
        </Button>
      )}
      <Button size="icon-lg" variant="outline" className="rounded-full" onClick={onShare} aria-label={t.app.share} title={t.app.share}><Share2 className="size-4" /></Button>
      <Button size="icon-lg" variant="ghost" className="rounded-full text-muted-foreground" aria-label={fmt(t.app.reportApp, { name: app.name })} title={t.app.report}
        onClick={() => (signedIn ? setReportOpen(true) : router.push(`${href("/sign-in")}?next=${encodeURIComponent(profile)}`))}>
        <Flag className="size-4" />
      </Button>
      <InstallDialog app={app} open={installOpen || hash === "#install"} onOpenChange={(open) => {
        setInstallOpen(open)
        if (!open && location.hash === "#install") { history.replaceState(null, "", location.pathname + location.search); window.dispatchEvent(new HashChangeEvent("hashchange")) }
      }} from={from} />
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} target={{ appId: app.id }} title={fmt(t.report.titleApp, { name: app.name })} kind="app" />
    </div>
  )
}
