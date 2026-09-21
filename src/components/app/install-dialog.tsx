"use client"

import { useEffect, useState } from "react"
import { Download, ExternalLink, MoreVertical, PlusSquare, Share } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AppIcon } from "./app-icon"
import { usePlatform } from "@/lib/use-platform"
import { track } from "@/lib/track"

interface BeforeInstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

function Step({ n, icon, title, body }: { n: number; icon: React.ReactNode; title: string; body: string }) {
  return (
    <li className="flex gap-3 rounded-2xl bg-muted/60 p-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-background text-brand shadow-soft">{icon}</span>
      <div><p className="text-sm font-semibold">{n}. {title}</p><p className="text-sm text-muted-foreground">{body}</p></div>
    </li>
  )
}

/**
 * Honest install guidance. Browsers only allow a site to trigger its own install prompt,
 * so PWANova cannot one-click install another origin's app. We guide, open the app, and
 * log `install_click` as an *install intent* (not a confirmed install).
 */
export function InstallDialog({ app, open, onOpenChange, from }: {
  app: { id: string; name: string; slug: string; iconUrl: string | null; url: string; isInstallable: boolean }
  open: boolean; onOpenChange: (o: boolean) => void; from?: string
}) {
  const { platform, browser } = usePlatform()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BeforeInstallPromptEvent) }
    window.addEventListener("beforeinstallprompt", onPrompt)
    return () => window.removeEventListener("beforeinstallprompt", onPrompt)
  }, [])
  useEffect(() => { if (open) track(app.id, "install_instruction_view", from) }, [open, app.id, from])

  const openApp = () => { track(app.id, "open_app", from); window.open(app.url, "_blank", "noopener,noreferrer") }
  const native = async () => { if (!deferred) return; await deferred.prompt(); setDeferred(null) }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3"><AppIcon app={app} size="sm" />
            <div><DialogTitle>Install {app.name}</DialogTitle><DialogDescription>{app.isInstallable ? "Add it to your home screen or desktop." : "This app isn't detected as installable yet, but you can still add a shortcut."}</DialogDescription></div>
          </div>
        </DialogHeader>

        {platform === "ios" && (
          <ol className="space-y-2">
            {browser !== "safari" && <li className="rounded-2xl border border-border p-3 text-sm text-muted-foreground">On iPhone, use <strong className="text-foreground">Safari</strong> to add web apps to your Home Screen.</li>}
            <Step n={1} icon={<Share className="size-4" />} title="Tap Share" body="The share icon in Safari's toolbar." />
            <Step n={2} icon={<PlusSquare className="size-4" />} title="Add to Home Screen" body="Scroll the share sheet and choose Add to Home Screen." />
            <Step n={3} icon={<Download className="size-4" />} title="Confirm Add" body={`Tap Add in the top corner. ${app.name} appears on your Home Screen.`} />
          </ol>
        )}
        {platform === "android" && (
          deferred ? (
            <Button size="lg" onClick={native} className="w-full"><Download className="size-4" />Install {app.name}</Button>
          ) : (
            <ol className="space-y-2">
              <Step n={1} icon={<ExternalLink className="size-4" />} title="Open the app" body={`Open ${app.name} in ${browser === "chrome" ? "Chrome" : "Chrome or your browser"}.`} />
              <Step n={2} icon={<MoreVertical className="size-4" />} title="Open the browser menu" body="Tap the ⋮ menu (Firefox: ⋮, Samsung Internet: ≡)." />
              <Step n={3} icon={<Download className="size-4" />} title="Install app / Add to Home screen" body="Confirm the prompt to add it." />
            </ol>
          )
        )}
        {platform === "desktop" && (
          <ol className="space-y-2">
            <Step n={1} icon={<ExternalLink className="size-4" />} title="Open the app" body={`Open ${app.name} in Chrome, Edge or Safari.`} />
            <Step n={2} icon={<Download className="size-4" />} title={browser === "safari" ? "File → Add to Dock" : "Click the install icon"} body={browser === "safari" ? "In Safari 17+, choose File → Add to Dock." : "Look for the install icon in the address bar, or menu → Install."} />
          </ol>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="lg" className="flex-1" onClick={openApp}><ExternalLink className="size-4" />{platform === "desktop" && !app.isInstallable ? "Open App" : `Open ${app.name} to install`}</Button>
          <Button size="lg" variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </div>
        <p className="text-xs text-muted-foreground">PWANova counts install actions, not confirmed installs, because browsers don&apos;t report installs across sites.</p>
      </DialogContent>
    </Dialog>
  )
}
