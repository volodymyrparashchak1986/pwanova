import Link from "next/link"
import { AppIcon } from "./app-icon"
import { RatingInline } from "./stars"
import { BuiltWithBadge, DemoChip, HostBadge, LaunchBadge, VerifiedBadge } from "./badges"
import { OpenAppButton } from "./open-app-button"
import { labelFor } from "@/lib/constants"
import type { AppView } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Full card used in grids (featured, explore). */
export function AppCard({ app, from, className }: { app: AppView; from?: string; className?: string }) {
  const href = `/apps/${app.slug}${from ? `?from=${from}` : ""}`
  return (
    <article className={cn("group relative flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lg", className)}>
      <div className="flex items-start gap-4">
        <AppIcon app={app} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold leading-tight">
            <Link href={href} className="after:absolute after:inset-0 after:rounded-3xl after:content-['']">{app.name}</Link>
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{app.tagline}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">{labelFor.category(app.category)}{app.developer.name ? ` · ${app.developer.name}` : ""}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <BuiltWithBadge tool={app.buildTool} />
        <HostBadge host={app.hostingProvider} />
        <LaunchBadge source={app.launchSource} />
      </div>
      <div className="mt-auto flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <RatingInline rating={app.rating} count={app.ratingsCount} />
          <div className="flex items-center gap-1"><VerifiedBadge app={app} className="relative z-10" />{app.isDemo && <DemoChip className="relative z-10" />}</div>
        </div>
        <span className="relative z-10"><OpenAppButton appId={app.id} url={app.url} from={from} demo={app.isDemo} /></span>
      </div>
    </article>
  )
}

/** Compact App Store style row with optional rank. */
export function AppRow({ app, rank, from }: { app: AppView; rank?: number; from?: string }) {
  const href = `/apps/${app.slug}${from ? `?from=${from}` : ""}`
  return (
    <article className="group relative flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-muted/60">
      {rank !== undefined && <span className="w-6 shrink-0 text-center text-lg font-semibold tabular-nums text-muted-foreground">{rank}</span>}
      <AppIcon app={app} size="sm" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-semibold leading-tight"><Link href={href} className="after:absolute after:inset-0 after:content-['']">{app.name}</Link></h3>
        <p className="truncate text-xs text-muted-foreground">{app.tagline}</p>
        <div className="mt-1 flex items-center gap-2"><RatingInline rating={app.rating} count={app.ratingsCount} />{app.verificationStatus === "verified" && <span className="text-[11px] font-medium text-brand">Verified ✓</span>}</div>
      </div>
      <span className="relative z-10"><OpenAppButton appId={app.id} url={app.url} from={from} demo={app.isDemo} /></span>
    </article>
  )
}
