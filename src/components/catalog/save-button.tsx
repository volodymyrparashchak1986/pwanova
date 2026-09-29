"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Bell, BellRing, Bookmark, BookmarkCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { toggleFollow } from "@/actions/account"
import { toggleFavorite } from "@/actions/engagement"
import { useI18n } from "@/i18n/client"
import { fmt } from "@/i18n/format"
import { cn } from "@/lib/utils"

interface Props { appId: string; slug: string; name: string; active: boolean; signedIn: boolean; variant?: "icon" | "full"; className?: string }

function useSignIn(slug: string) {
  const router = useRouter()
  const { href } = useI18n()
  return () => router.push(`${href("/sign-in")}?next=${encodeURIComponent(href(`/apps/${slug}`))}`)
}

export function SaveButton({ appId, slug, name, active: initial, signedIn, variant = "icon", className }: Props) {
  const { t } = useI18n()
  const signIn = useSignIn(slug)
  const [active, setActive] = useState(initial)
  const [pending, start] = useTransition()
  const onClick = () => {
    if (!signedIn) return signIn()
    const next = !active
    setActive(next)
    start(async () => {
      const r = await toggleFavorite(appId)
      if (!r.ok) { setActive(!next); toast.error(r.error) } else toast.success(r.data?.saved ? t.app.savedToast : t.app.unsavedToast)
    })
  }
  const Icon = active ? BookmarkCheck : Bookmark
  const label = active ? t.card.unsaveApp : t.card.saveApp
  if (variant === "full") {
    return <Button size="lg" variant={active ? "default" : "outline"} className={cn("rounded-full", className)} aria-pressed={active} disabled={pending} onClick={onClick}><Icon className="size-4" />{label}</Button>
  }
  return <Button size="icon" variant={active ? "default" : "outline"} className={cn("rounded-full", className)} aria-pressed={active} aria-label={`${label}: ${name}`} title={label} disabled={pending} onClick={onClick}><Icon className="size-4" /></Button>
}

/** Follow an app to get an in-app notification when it publishes an update. */
export function FollowButton({ appId, slug, name, active: initial, signedIn, className }: Omit<Props, "variant">) {
  const { t } = useI18n()
  const signIn = useSignIn(slug)
  const [active, setActive] = useState(initial)
  const [pending, start] = useTransition()
  const Icon = active ? BellRing : Bell
  return (
    <Button size="lg" variant={active ? "secondary" : "outline"} className={cn("rounded-full", className)} aria-pressed={active} disabled={pending} title={t.app.followHelp}
      onClick={() => {
        if (!signedIn) return signIn()
        const next = !active
        setActive(next)
        start(async () => {
          const r = await toggleFollow(appId)
          if (!r.ok) { setActive(!next); toast.error(r.error) } else toast.success(fmt(r.data?.following ? t.app.followToast : t.app.unfollowToast, { name }))
        })
      }}>
      <Icon className="size-4" />{active ? t.app.following : t.app.follow}
    </Button>
  )
}
