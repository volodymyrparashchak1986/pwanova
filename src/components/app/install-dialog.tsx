"use client"

import { useEffect } from "react"
import { Download, ExternalLink, MoreVertical, PlusSquare, Share } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AppIcon } from "./app-icon"
import { useI18n } from "@/i18n/client"
import { fmt } from "@/i18n/format"
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

const ICONS = {
  ios: [ExternalLink, Share, PlusSquare, Download],
  android: [ExternalLink, MoreVertical, Download],
  desktop: [ExternalLink, Download],
} as const

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
  app: { id: string; name: string; slug: string; iconUrl: string | null; url: string }
  open: boolean; onOpenChange: (o: boolean) => void; from?: string
}) {
  const { t } = useI18n()
  const { platform, browser } = usePlatform()
  const domain = (() => { try { return new URL(app.url).hostname } catch { return app.url } })()
  const vars = { name: app.name, domain }

  useEffect(() => { if (open) track(app.id, "install_instruction_view", from) }, [open, app.id, from])

  const openApp = () => { track(app.id, "open_app", from); window.open(app.url, "_blank", "noopener,noreferrer") }
  const steps = t.install[platform]
  const icons = ICONS[platform]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3"><AppIcon app={app} size="sm" />
            <div><DialogTitle>{fmt(t.install.title, vars)}</DialogTitle><DialogDescription>{fmt(t.install.intro, vars)}</DialogDescription></div>
          </div>
        </DialogHeader>
        <ol className="space-y-2">
          {platform === "ios" && browser !== "safari" && <li className="rounded-2xl border border-border p-3 text-sm text-muted-foreground">{t.install.useSafari}</li>}
          {steps.map((s, i) => {
            const Icon = icons[i] ?? Download
            return <Step key={s.title} n={i + 1} icon={<Icon className="size-4" />} title={fmt(s.title, vars)} body={fmt(s.body, vars)} />
          })}
        </ol>
        <p className="text-sm text-muted-foreground">{t.install.fallback}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="lg" className="flex-1" onClick={openApp}><ExternalLink className="size-4" />{fmt(t.install.open, vars)}</Button>
          <Button size="lg" variant="outline" onClick={() => onOpenChange(false)}>{t.install.done}</Button>
        </div>
        <p className="text-xs text-muted-foreground">{t.install.note}</p>
      </DialogContent>
    </Dialog>
  )
}
