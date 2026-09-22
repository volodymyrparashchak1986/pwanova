"use client"

import { useEffect } from "react"
import { Download, ExternalLink, MoreVertical, PlusSquare, Share } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AppIcon } from "./app-icon"
import { usePlatform } from "@/lib/use-platform"
import { track } from "@/lib/track"

function Step({ n, icon, title, body }: { n: number; icon: React.ReactNode; title: string; body: string }) {
  return (
    <li className="flex gap-3 rounded-2xl bg-muted/60 p-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-background text-brand shadow-soft">{icon}</span>
      <div><p className="text-sm font-semibold">{n}. {title}</p><p className="text-sm text-muted-foreground">{body}</p></div>
    </li>
  )
}

/**
 * Honest install guidance for a THIRD-PARTY app (App A = PWANova, App B = the listed app).
 *
 * This dialog intentionally never touches `beforeinstallprompt`. That event only ever fires for the
 * page that's currently loaded — i.e. PWANova itself — never for App B, which PWANova cannot see or
 * control from a different origin. Wiring it up here would silently install *PWANova* while the
 * button said "Install {App B's name}": a real bug found in an earlier version (see docs/beta-audit.md,
 * row P0-3) and now guarded by tests/install-dialog.test.ts. The only correct flow the web platform
 * allows is: explain, send the person to App B's own origin, let App B install itself.
 */
export function InstallDialog({ app, open, onOpenChange, from }: {
  app: { id: string; name: string; slug: string; iconUrl: string | null; url: string; isInstallable: boolean }
  open: boolean; onOpenChange: (o: boolean) => void; from?: string
}) {
  const { platform, browser } = usePlatform()
  const domain = (() => { try { return new URL(app.url).hostname } catch { return app.url } })()

  useEffect(() => { if (open) track(app.id, "install_instruction_view", from) }, [open, app.id, from])

  const openApp = () => { track(app.id, "open_app", from); window.open(app.url, "_blank", "noopener,noreferrer") }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3"><AppIcon app={app} size="sm" />
            <div><DialogTitle>Install {app.name}</DialogTitle>
              <DialogDescription>You&apos;ll install it from <strong className="text-foreground">{domain}</strong> — the steps happen on {app.name}&apos;s own site, not on PWANova.</DialogDescription></div>
          </div>
        </DialogHeader>

        {platform === "ios" && (
          <ol className="space-y-2">
            {browser !== "safari" && <li className="rounded-2xl border border-border p-3 text-sm text-muted-foreground">On iPhone, use <strong className="text-foreground">Safari</strong> to add web apps to your Home Screen.</li>}
            <Step n={1} icon={<ExternalLink className="size-4" />} title={`Open ${domain}`} body="Tap the button below. This leaves PWANova and opens the app's own site." />
            <Step n={2} icon={<Share className="size-4" />} title="Tap Share" body="The share icon in Safari's toolbar, on that site." />
            <Step n={3} icon={<PlusSquare className="size-4" />} title="Add to Home Screen" body="Scroll the share sheet and choose Add to Home Screen." />
            <Step n={4} icon={<Download className="size-4" />} title="Confirm Add" body={`Tap Add in the top corner. ${app.name} appears on your Home Screen.`} />
          </ol>
        )}
        {platform === "android" && (
          <ol className="space-y-2">
            <Step n={1} icon={<ExternalLink className="size-4" />} title={`Open ${domain}`} body={`Tap the button below to open ${app.name} in ${browser === "chrome" ? "Chrome" : "your browser"}.`} />
            <Step n={2} icon={<MoreVertical className="size-4" />} title="Open the browser menu on that site" body="Tap the ⋮ menu (Firefox: ⋮, Samsung Internet: ≡)." />
            <Step n={3} icon={<Download className="size-4" />} title="Install app / Add to Home screen" body={`Confirm the prompt. It installs ${app.name}, not PWANova.`} />
          </ol>
        )}
        {platform === "desktop" && (
          <ol className="space-y-2">
            <Step n={1} icon={<ExternalLink className="size-4" />} title={`Open ${domain}`} body={`Tap the button below to open ${app.name} in Chrome, Edge or Safari.`} />
            <Step n={2} icon={<Download className="size-4" />} title={browser === "safari" ? "File → Add to Dock" : "Click the install icon on that site"} body={browser === "safari" ? "In Safari 17+, choose File → Add to Dock while on the app's site." : "Look for the install icon in the address bar, or menu → Install, while on the app's site."} />
          </ol>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="lg" className="flex-1" onClick={openApp}><ExternalLink className="size-4" />Open {domain}</Button>
          <Button size="lg" variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </div>
        <p className="text-xs text-muted-foreground">PWANova counts install actions (clicks on Install), not confirmed installs — browsers don&apos;t report installs across sites.</p>
      </DialogContent>
    </Dialog>
  )
}
