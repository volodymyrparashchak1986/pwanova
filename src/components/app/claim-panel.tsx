"use client"

import { useState, useSyncExternalStore, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { startClaim, verifyClaim } from "@/actions/apps"
import { cn } from "@/lib/utils"

type Method = "meta_tag" | "well_known" | "dns_txt"
export interface ClaimInstructions { title: string; snippet: string; where: string }

// Beta ships exactly one fully proven method end-to-end. The others are implemented server-side but
// not offered yet, per the "don't show a method as available unless it demonstrably works" rule.
const ACTIVE_METHOD: Method = "well_known"

const noSubscribe = () => () => {}
/** "Is this deadline already past?" read via useSyncExternalStore, the same idiom usePlatform() uses,
 *  so comparing against the current time never happens directly during render (Date.now() there is
 *  flagged as an impure call by the purity lint rule). The server re-checks expiry authoritatively
 *  either way -- this only drives which button the panel shows. */
function useIsPast(iso: string | null | undefined): boolean {
  return useSyncExternalStore(noSubscribe, () => Boolean(iso) && new Date(iso!).getTime() < Date.now(), () => false)
}

export function ClaimPanel({ appId, hasClaim, instructions, expiresAt }: {
  appId: string; hasClaim: boolean; instructions: Record<Method, ClaimInstructions> | null; expiresAt?: string | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const method = ACTIVE_METHOD
  const expired = useIsPast(expiresAt)

  if (!hasClaim || !instructions) {
    return (
      <Button size="lg" className="rounded-full" disabled={pending} onClick={() => start(async () => {
        const r = await startClaim(appId)
        if (r.ok) router.refresh(); else toast.error(r.error)
      })}>{pending && <Loader2 className="size-4 animate-spin" />}Start ownership claim</Button>
    )
  }
  const current = instructions[method]
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="tablist">
        <span role="tab" aria-selected className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{current.title}</span>
        {(Object.keys(instructions) as Method[]).filter((m) => m !== method).map((m) => (
          <span key={m} role="tab" aria-selected={false} aria-disabled title="Not offered yet for the beta" className="cursor-not-allowed rounded-full bg-muted px-4 py-2 text-sm font-medium text-muted-foreground/60">{instructions[m].title} · Coming later</span>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">{current.where}</p>
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-background p-3 font-mono text-[13px] break-all">
          <code className="flex-1 select-all">{current.snippet}</code>
          <button aria-label="Copy" onClick={() => { navigator.clipboard.writeText(current.snippet); toast.success("Copied") }}><Copy className="size-4 text-muted-foreground" /></button>
        </div>
      </div>
      {expiresAt && (
        <p className={cn("text-xs", expired ? "text-destructive" : "text-muted-foreground")}>
          {expired ? "This token expired." : `This token expires ${new Date(expiresAt).toLocaleString()}.`} {expired && "Restart the claim below to get a fresh one."}
        </p>
      )}
      {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {expired ? (
          <Button size="lg" className="rounded-full" disabled={pending} onClick={() => start(async () => {
            const r = await startClaim(appId)
            if (r.ok) router.refresh(); else toast.error(r.error)
          })}>{pending && <Loader2 className="size-4 animate-spin" />}Restart claim</Button>
        ) : (
          <Button size="lg" className="rounded-full" disabled={pending} onClick={() => start(async () => {
            setError(null)
            const r = await verifyClaim(appId, method)
            if (r.ok) { toast.success(r.message); router.refresh() } else setError(r.error)
          })}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Verify ownership</Button>
        )}
      </div>
    </div>
  )
}
