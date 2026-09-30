import { BadgeCheck, CircleDashed, FlaskConical } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Dictionary } from "@/i18n/dictionaries"
import type { OwnershipStatus } from "@/lib/v2/types"
import { cn } from "@/lib/utils"

/**
 * Who stands behind a listing. "Ownership verified" means control of the domain was demonstrated;
 * it says nothing about quality, security or compliance, and the tooltip says so.
 */
export function OwnershipBadge({ status, t, showUnverified = false, className }: { status: OwnershipStatus; t: Dictionary["card"]; showUnverified?: boolean; className?: string }) {
  const verified = status === "verified_owner"
  if (!verified && !showUnverified) return null
  return (
    <Tooltip>
      <TooltipTrigger render={<span className={cn("inline-flex cursor-help items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", verified ? "bg-brand/10 text-brand" : "border border-dashed border-border font-medium text-muted-foreground", className)} />}>
        {verified ? <BadgeCheck className="size-3.5" aria-hidden /> : <CircleDashed className="size-3" aria-hidden />}{t.owner[status]}
      </TooltipTrigger>
      <TooltipContent className="max-w-60">{t.ownerHelp[status]}</TooltipContent>
    </Tooltip>
  )
}

export function DemoChip({ t, className }: { t: Dictionary["common"]; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className={cn("inline-flex cursor-help items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground", className)} />}>
        <FlaskConical className="size-3" aria-hidden />{t.demo}
      </TooltipTrigger>
      <TooltipContent className="max-w-56">{t.demoTooltip}</TooltipContent>
    </Tooltip>
  )
}
