"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

type Result = { ok: true; message?: string } | { ok: false; error: string }

/** Runs a server action, shows its message, and reloads the server-rendered data when it worked. */
export function useAction() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<Result>, opts: { after?: () => void; success?: string } = {}) => start(async () => {
    const r = await fn()
    if (r.ok) {
      const message = opts.success ?? r.message
      if (message) toast.success(message)
      opts.after?.()
      router.refresh()
    } else toast.error(r.error)
  })
  return { pending, run }
}
