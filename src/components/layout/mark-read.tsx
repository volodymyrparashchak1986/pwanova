"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { markNotificationsRead } from "@/actions/account"

export function MarkAllRead({ label }: { label: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button variant="outline" className="rounded-full" disabled={pending} onClick={() => start(async () => { const r = await markNotificationsRead(); if (r.ok) router.refresh(); else toast.error(r.error) })}>
      <CheckCheck className="size-4" />{label}
    </Button>
  )
}
