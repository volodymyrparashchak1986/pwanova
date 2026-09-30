"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { submitReport } from "@/actions/engagement"
import { useI18n } from "@/i18n/client"
import { REPORT_REASONS } from "@/lib/constants"

type Reason = (typeof REPORT_REASONS)[number]
export interface ReportTarget { appId?: string; reviewId?: string; evidenceId?: string; launchId?: string; requestId?: string }

/** The reasons offered depend on what is reported: "fake review" makes no sense for a DPA link. */
const REASONS: Record<"app" | "review" | "evidence", Reason[]> = {
  app: ["incorrect_information", "broken", "impersonation", "malicious", "spam", "inappropriate", "other"],
  review: ["fake_review", "spam", "inappropriate", "other"],
  evidence: ["incorrect_information", "outdated_evidence", "other"],
}

export function ReportDialog({ open, onOpenChange, target, title, kind = "app" }: {
  open: boolean; onOpenChange: (o: boolean) => void; target: ReportTarget; title: string; kind?: keyof typeof REASONS
}) {
  const { t } = useI18n()
  const [reason, setReason] = useState<Reason>(REASONS[kind][0])
  const [details, setDetails] = useState("")
  const [pending, start] = useTransition()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{t.report.body}</DialogDescription></DialogHeader>
        <label className="space-y-1.5 text-sm font-medium">{t.report.reason}
          <select value={reason} onChange={(e) => setReason(e.target.value as Reason)} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
            {REASONS[kind].map((r) => <option key={r} value={r}>{t.report.reasons[r]}</option>)}
          </select>
        </label>
        <Textarea placeholder={t.report.details} aria-label={t.report.details} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
        <Button disabled={pending} onClick={() => start(async () => {
          const r = await submitReport({ ...target, reason, details })
          if (r.ok) { toast.success(t.report.thanks); onOpenChange(false); setDetails("") } else toast.error(r.error)
        })}>{t.report.submit}</Button>
      </DialogContent>
    </Dialog>
  )
}

/** A small "report" control for server-rendered pages. */
export function ReportButton({ target, title, kind, label, signedIn, next, className }: { target: ReportTarget; title: string; kind: keyof typeof REASONS; label: string; signedIn: boolean; next: string; className?: string }) {
  const { t, href } = useI18n()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={className ?? "text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"}
        onClick={() => { if (signedIn) setOpen(true); else { toast.info(t.report.signIn); router.push(`${href("/sign-in")}?next=${encodeURIComponent(href(next))}`) } }}>
        {label}
      </button>
      <ReportDialog open={open} onOpenChange={setOpen} target={target} title={title} kind={kind} />
    </>
  )
}
