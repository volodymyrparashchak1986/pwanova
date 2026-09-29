"use client"

import { GitCompareArrows, Check } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { compareStore, useCompare, type CompareItem } from "./store"
import { useI18n } from "@/i18n/client"
import { track } from "@/lib/track"
import { cn } from "@/lib/utils"

/** Adds an app to the comparison (up to four) or removes it again. Works without an account. */
export function CompareButton({ app, variant = "icon", className }: { app: CompareItem; variant?: "icon" | "full"; className?: string }) {
  const { t } = useI18n()
  const active = useCompare().some((i) => i.slug === app.slug)
  const onClick = () => {
    if (active) { compareStore.remove(app.slug); return }
    if (!compareStore.add(app)) { toast.info(t.compare.max); return }
    track(app.id, "compare_added")
    toast.success(t.compare.added)
  }
  const label = active ? t.card.compareRemove : t.card.compareAdd
  if (variant === "full") {
    return (
      <Button size="lg" variant={active ? "default" : "outline"} className={cn("rounded-full", className)} aria-pressed={active} onClick={onClick}>
        {active ? <Check className="size-4" /> : <GitCompareArrows className="size-4" />}{active ? t.app.inCompare : t.app.compare}
      </Button>
    )
  }
  return (
    <Button size="icon" variant={active ? "default" : "outline"} className={cn("rounded-full", className)} aria-pressed={active} aria-label={`${label}: ${app.name}`} title={label} onClick={onClick}>
      {active ? <Check className="size-4" /> : <GitCompareArrows className="size-4" />}
    </Button>
  )
}
