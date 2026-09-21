"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { startClaim, verifyClaim } from "@/actions/apps"
import { cn } from "@/lib/utils"

type Method = "meta_tag" | "well_known" | "dns_txt"
export interface ClaimInstructions { title: string; snippet: string; where: string }

export function ClaimPanel({ appId, hasClaim, instructions }: { appId: string; hasClaim: boolean; instructions: Record<Method, ClaimInstructions> | null }) {
  const router = useRouter()
  const [method, setMethod] = useState<Method>("meta_tag")
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

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
        {(Object.keys(instructions) as Method[]).map((m) => (
          <button key={m} role="tab" aria-selected={method === m} onClick={() => { setMethod(m); setError(null) }}
            className={cn("rounded-full px-4 py-2 text-sm font-medium transition-colors", method === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>{instructions[m].title}</button>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">{current.where}</p>
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-background p-3 font-mono text-[13px] break-all">
          <code className="flex-1 select-all">{current.snippet}</code>
          <button aria-label="Copy" onClick={() => { navigator.clipboard.writeText(current.snippet); toast.success("Copied") }}><Copy className="size-4 text-muted-foreground" /></button>
        </div>
      </div>
      {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <Button size="lg" className="rounded-full" disabled={pending} onClick={() => start(async () => {
        setError(null)
        const r = await verifyClaim(appId, method)
        if (r.ok) { toast.success(r.message); router.refresh() } else setError(r.error)
      })}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Verify ownership</Button>
    </div>
  )
}
