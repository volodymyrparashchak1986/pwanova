"use client"

import { useState, useSyncExternalStore, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { startClaim, verifyClaim } from "@/actions/apps"
import { useI18n } from "@/i18n/client"
import { fmt, formatDate } from "@/i18n/format"
import { cn } from "@/lib/utils"

type Method = "meta_tag" | "well_known" | "dns_txt"

// One method is proven end to end. The others are named, marked as not offered, and cannot be chosen.
const ACTIVE_METHOD: Method = "well_known"
const METHODS: Method[] = ["well_known", "meta_tag", "dns_txt"]

const noSubscribe = () => () => {}
/** "Is this deadline already past?" read via useSyncExternalStore, so the clock is never read during render.
 *  The server checks the expiry again either way; this only decides which button the panel shows. */
function useIsPast(iso: string | null | undefined): boolean {
  return useSyncExternalStore(noSubscribe, () => Boolean(iso) && new Date(iso!).getTime() < Date.now(), () => false)
}

export function ClaimPanel({ appId, token, fileUrl, expiresAt }: { appId: string; token: string | null; fileUrl: string | null; expiresAt?: string | null }) {
  const { t, locale } = useI18n("claim")
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const expired = useIsPast(expiresAt)
  const begin = () => start(async () => {
    const r = await startClaim(appId)
    if (r.ok) router.refresh(); else toast.error(r.error)
  })

  if (!token || !fileUrl) {
    return <Button size="lg" className="rounded-full" disabled={pending} onClick={begin}>{pending && <Loader2 className="size-4 animate-spin" />}{t.claim.start}</Button>
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {METHODS.map((m) => m === ACTIVE_METHOD
          ? <span key={m} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{t.claim.methods[m]}</span>
          : <span key={m} aria-disabled className="cursor-not-allowed rounded-full bg-muted px-4 py-2 text-sm font-medium text-muted-foreground/60">{t.claim.methods[m]} · {t.claim.notOffered}</span>)}
      </div>
      <div className="rounded-2xl border border-border bg-muted/50 p-4">
        <p className="text-sm break-words text-muted-foreground">{fmt(t.claim.where, { url: fileUrl })}</p>
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-background p-3 font-mono text-[13px] break-all">
          <code className="flex-1 select-all">{token}</code>
          <button type="button" aria-label={t.claim.copyToken} onClick={() => { navigator.clipboard.writeText(token).then(() => toast.success(t.common.copied)).catch(() => {}) }}><Copy className="size-4 text-muted-foreground" /></button>
        </div>
      </div>
      {expiresAt && <p suppressHydrationWarning className={cn("text-xs", expired ? "text-destructive" : "text-muted-foreground")}>{expired ? t.claim.expired : fmt(t.claim.expires, { date: formatDate(locale, expiresAt, "long") })}</p>}
      {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {expired ? (
          <Button size="lg" className="rounded-full" disabled={pending} onClick={begin}>{pending && <Loader2 className="size-4 animate-spin" />}{t.claim.restart}</Button>
        ) : (
          <Button size="lg" className="rounded-full" disabled={pending} onClick={() => start(async () => {
            setError(null)
            const r = await verifyClaim(appId, ACTIVE_METHOD)
            if (r.ok) { toast.success(t.claim.verified); router.refresh() } else setError(r.error)
          })}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}{t.claim.verify}</Button>
        )}
      </div>
    </div>
  )
}
