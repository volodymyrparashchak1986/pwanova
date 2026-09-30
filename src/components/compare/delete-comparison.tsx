"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { deleteComparison } from "@/actions/account"
import { useI18n } from "@/i18n/client"

export function DeleteComparison({ id }: { id: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <button type="button" disabled={pending} aria-label={t.compare.deleteSaved} title={t.compare.deleteSaved} className="text-muted-foreground hover:text-destructive disabled:opacity-50"
      onClick={() => start(async () => { const r = await deleteComparison(id); if (r.ok) router.refresh(); else toast.error(r.error) })}>
      <Trash2 className="size-4" />
    </button>
  )
}
