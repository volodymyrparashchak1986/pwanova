"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Bookmark, Check, Download, ExternalLink, Flag, Share2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { InstallDialog } from "./install-dialog"
import { ReportDialog } from "./report-dialog"
import { toggleFavorite } from "@/actions/engagement"
import { track } from "@/lib/track"
import { usePlatform } from "@/lib/use-platform"

export function AppActions({ app, signedIn, saved: initialSaved, from }: {
  app: { id: string; name: string; slug: string; iconUrl: string | null; url: string; isInstallable: boolean; isDemo: boolean }
  signedIn: boolean; saved: boolean; from?: string
}) {
  const router = useRouter()
  const [saved, setSaved] = useState(initialSaved)
  const [installOpen, setInstallOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [, start] = useTransition()
  const { platform } = usePlatform()
  const desktopOpenOnly = platform === "desktop" && !app.isInstallable

  const onSave = () => {
    if (!signedIn) return router.push(`/sign-in?next=/apps/${app.slug}`)
    const next = !saved
    setSaved(next)
    start(async () => {
      const r = await toggleFavorite(app.id)
      if (!r.ok) { setSaved(!next); toast.error(r.error) } else toast.success(r.data?.saved ? "Saved to your apps" : "Removed from saved")
    })
  }
  const onShare = async () => {
    const url = `${location.origin}/apps/${app.slug}`
    track(app.id, "share", from)
    try {
      if (navigator.share) await navigator.share({ title: app.name, url })
      else { await navigator.clipboard.writeText(url); toast.success("Link copied") }
    } catch { /* user cancelled */ }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="lg" className="rounded-full" nativeButton={false}
        render={<a href={app.url} target="_blank" rel="noopener noreferrer" onClick={() => track(app.id, "open_app", from)} />}>
        Open App <ExternalLink className="size-4" />
      </Button>
      <Button size="lg" variant="secondary" className="rounded-full" onClick={() => { track(app.id, "install_click", from); setInstallOpen(true) }}>
        <Download className="size-4" />{desktopOpenOnly ? "Add" : "Install"}
      </Button>
      <Button size="lg" variant={saved ? "default" : "outline"} className="rounded-full" onClick={onSave} aria-pressed={saved}>
        {saved ? <Check className="size-4" /> : <Bookmark className="size-4" />}{saved ? "Saved" : "Save"}
      </Button>
      <Button size="icon-lg" variant="outline" className="rounded-full" onClick={onShare} aria-label="Share"><Share2 className="size-4" /></Button>
      <Button size="icon-lg" variant="ghost" className="rounded-full text-muted-foreground" onClick={() => (signedIn ? setReportOpen(true) : router.push(`/sign-in?next=/apps/${app.slug}`))} aria-label="Report app"><Flag className="size-4" /></Button>
      <InstallDialog app={app} open={installOpen} onOpenChange={setInstallOpen} from={from} />
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} target={{ appId: app.id }} title={`Report ${app.name}`} />
    </div>
  )
}
