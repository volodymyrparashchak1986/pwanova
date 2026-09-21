"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { adminAction } from "@/actions/admin"

type Kind = Parameters<typeof adminAction>[0]["kind"]

export function AdminButtons({ id, actions }: { id: string; actions: { kind: Kind; label: string; danger?: boolean }[] }) {
  const [pending, start] = useTransition()
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map((a) => (
        <Button key={a.kind} size="sm" variant={a.danger ? "destructive" : "outline"} disabled={pending} onClick={() => start(async () => {
          if (a.danger && !confirm(`${a.label}?`)) return
          const r = await adminAction({ kind: a.kind, id })
          if (r.ok) toast.success("Done"); else toast.error(r.error)
        })}>{a.label}</Button>
      ))}
    </div>
  )
}
