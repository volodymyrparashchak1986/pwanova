import { Check, Minus, X } from "lucide-react"
import { timeAgo } from "@/lib/format"
import type { AppView } from "@/lib/types"
import { cn } from "@/lib/utils"

const HEALTH = { online: ["Online", "bg-ok"], degraded: ["Degraded", "bg-star"], offline: ["Offline", "bg-destructive"], unknown: ["Not checked", "bg-muted-foreground/40"] } as const

function Mark({ v }: { v: boolean | null | undefined }) {
  if (v === true) return <span className="grid size-6 place-items-center rounded-full bg-ok/15 text-ok" aria-label="Yes"><Check className="size-3.5" strokeWidth={3} /></span>
  if (v === false) return <span className="grid size-6 place-items-center rounded-full bg-destructive/10 text-destructive" aria-label="No"><X className="size-3.5" strokeWidth={3} /></span>
  return <span className="grid size-6 place-items-center rounded-full bg-muted text-muted-foreground" aria-label="Unknown"><Minus className="size-3.5" /></span>
}

export function QualityPanel({ app }: { app: AppView }) {
  const c = app.checks
  const rows: [string, boolean | null | undefined][] = [
    ["HTTPS", c?.httpsOk], ["Responsive", c?.responsive], ["Mobile optimized", c?.mobileOptimized],
    ["PWA Manifest", c?.manifestOk], ["Installable", c?.installable], ["Service Worker", c?.serviceWorkerOk],
    ["Offline support", c?.offlineSupport], ["Push support", c?.pushSupport],
  ]
  const [label, dot] = HEALTH[app.healthStatus]
  return (
    <div className="rounded-3xl border border-border bg-card p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Web App Quality</h3>
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><span className={cn("size-2 rounded-full", dot)} />{label}{c?.lastCheckedAt && <span>· Last checked {timeAgo(c.lastCheckedAt)}</span>}</p>
      </div>
      {c ? (
        <ul className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
          {rows.map(([name, v]) => <li key={name} className="flex items-center justify-between border-b border-border/60 pb-2.5 text-sm"><span>{name}</span><Mark v={v} /></li>)}
        </ul>
      ) : <p className="mt-3 text-sm text-muted-foreground">No quality check has run for this app yet.</p>}
      <p className="mt-4 text-xs text-muted-foreground">Offline and push support can&apos;t be verified from outside the app, so they show as unknown (—) rather than guessed.</p>
    </div>
  )
}
