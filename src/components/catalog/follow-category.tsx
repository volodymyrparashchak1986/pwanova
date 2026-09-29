"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Bell, BellRing } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { toggleCategoryFollow } from "@/actions/account"
import { useI18n } from "@/i18n/client"

export function FollowCategoryButton({ categoryId, slug, active: initial, signedIn }: { categoryId: string; slug: string; active: boolean; signedIn: boolean }) {
  const { t, href } = useI18n()
  const router = useRouter()
  const [active, setActive] = useState(initial)
  const [pending, start] = useTransition()
  const Icon = active ? BellRing : Bell
  return (
    <Button variant={active ? "secondary" : "outline"} className="rounded-full" aria-pressed={active} disabled={pending}
      onClick={() => {
        if (!signedIn) return router.push(`${href("/sign-in")}?next=${encodeURIComponent(href(`/categories/${slug}`))}`)
        const next = !active
        setActive(next)
        start(async () => {
          const r = await toggleCategoryFollow(categoryId)
          if (!r.ok) { setActive(!next); toast.error(r.error) }
        })
      }}>
      <Icon className="size-4" />{active ? t.categories.following : t.categories.follow}
    </Button>
  )
}
