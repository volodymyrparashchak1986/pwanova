"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { submitReport } from "@/actions/engagement"
import { REPORT_REASONS } from "@/lib/constants"

export function ReportDialog({ open, onOpenChange, target, title }: {
  open: boolean; onOpenChange: (o: boolean) => void; target: { appId?: string; reviewId?: string }; title: string
}) {
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]>("spam")
  const [details, setDetails] = useState("")
  const [pending, start] = useTransition()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Tell us what&apos;s wrong. Reports are reviewed by moderators.</DialogDescription></DialogHeader>
        <label className="space-y-1.5 text-sm font-medium">Reason
          <select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm capitalize">
            {REPORT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <Textarea placeholder="Optional details" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
        <Button disabled={pending} onClick={() => start(async () => {
          const r = await submitReport({ ...target, reason, details })
          if (r.ok) { toast.success(r.message); onOpenChange(false); setDetails("") } else toast.error(r.error)
        })}>Submit report</Button>
      </DialogContent>
    </Dialog>
  )
}
