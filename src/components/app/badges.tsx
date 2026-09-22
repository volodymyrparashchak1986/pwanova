import Link from "next/link"
import { BadgeCheck, Hammer, Rocket, Server, Compass, FlaskConical } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { labelFor } from "@/lib/constants"
import type { AppView } from "@/lib/types"
import { cn } from "@/lib/utils"

const pill = "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"

export function BuiltWithBadge({ tool, linked, className }: { tool: string; linked?: boolean; className?: string }) {
  const inner = <><Hammer className="size-3" />Built with {labelFor.build(tool)}</>
  return linked ? <Link href={`/explore?build=${tool}`} className={cn(pill, "hover:text-foreground", className)}>{inner}</Link> : <span className={cn(pill, className)}>{inner}</span>
}

export function HostBadge({ host, linked, className }: { host: string; linked?: boolean; className?: string }) {
  const inner = <><Server className="size-3" />{host === "custom-domain" ? "Custom domain" : `Hosted on ${labelFor.host(host)}`}</>
  return linked ? <Link href={`/explore?host=${host}`} className={cn(pill, "hover:text-foreground", className)}>{inner}</Link> : <span className={cn(pill, className)}>{inner}</span>
}

export function LaunchBadge({ source, linked, className }: { source: AppView["launchSource"]; linked?: boolean; className?: string }) {
  if (!source) return null
  const inner = <>{source.type === "launched_on" ? <Rocket className="size-3" /> : <Compass className="size-3" />}{source.type === "launched_on" ? "Launched on" : "Discovered via"} {source.name}</>
  return linked ? <Link href={`/explore?launch=${encodeURIComponent(source.name)}`} className={cn(pill, "hover:text-foreground", className)}>{inner}</Link> : <span className={cn(pill, className)}>{inner}</span>
}

/** Shown only when verification_status = 'verified'. Never rendered speculatively. */
export function VerifiedBadge({ app, className }: { app: Pick<AppView, "ownershipStatus">; className?: string }) {
  if (app.ownershipStatus !== "verified_owner") return null
  return (
    <Tooltip>
      <TooltipTrigger render={<span className={cn("inline-flex cursor-help items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand", className)} />}>
        <BadgeCheck className="size-3.5" />Ownership verified
      </TooltipTrigger>
      <TooltipContent className="max-w-56">The owner demonstrated control of the app origin. This is not a security audit or a guarantee of quality.</TooltipContent>
    </Tooltip>
  )
}

export function DemoChip({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className={cn("inline-flex cursor-help items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground", className)} />}>
        <FlaskConical className="size-3" />Demo data
      </TooltipTrigger>
      <TooltipContent className="max-w-56">Fabricated sample listing for development. Its site does not exist.</TooltipContent>
    </Tooltip>
  )
}
