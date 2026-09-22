"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { adminAction, reassignOwner } from "@/actions/admin"

type Kind = Parameters<typeof adminAction>[0]["kind"]
// Actions where a moderator's reason is worth recording and (for reject/hide/suspend) is shown to the developer.
const ASKS_REASON: Kind[] = ["reject", "hide", "suspend"]

export function AdminButtons({ id, actions }: { id: string; actions: { kind: Kind; label: string; danger?: boolean }[] }) {
  const [pending, start] = useTransition()
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map((a) => (
        <Button key={a.kind} size="sm" variant={a.danger ? "destructive" : "outline"} disabled={pending} onClick={() => start(async () => {
          let reason: string | undefined
          if (ASKS_REASON.includes(a.kind)) {
            const input = window.prompt(`Reason for "${a.label}" (shown to the developer):`)
            if (input === null) return // cancelled
            reason = input.trim() || undefined
          } else if (a.danger && !confirm(`${a.label}?`)) return
          const r = await adminAction({ kind: a.kind, id, reason })
          if (r.ok) toast.success("Done"); else toast.error(r.error)
        })}>{a.label}</Button>
      ))}
    </div>
  )
}

/** Dispute-resolution: move a verified app to a different developer by username, with a required reason. */
export function ReassignOwnerForm({ appId }: { appId: string }) {
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState("")
  const [pending, start] = useTransition()
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Reassign owner</Button>
  return (
    <form className="flex flex-wrap items-center gap-1.5" onSubmit={(e) => {
      e.preventDefault()
      const reason = window.prompt("Why is ownership being reassigned? (required for the audit log)")
      if (!reason?.trim()) return
      start(async () => {
        const r = await reassignOwner({ appId, targetUsername: username.trim(), reason })
        if (r.ok) { toast.success(r.message); setOpen(false); setUsername("") } else toast.error(r.error)
      })
    }}>
      <input required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="new-owner-username" className="h-8 w-40 rounded-lg border border-input bg-background px-2 text-xs" />
      <Button size="sm" type="submit" disabled={pending}>Confirm</Button>
      <Button size="sm" type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
    </form>
  )
}
