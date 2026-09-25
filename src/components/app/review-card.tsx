import Link from "next/link"
import { BadgeCheck, CornerDownRight, ThumbsUp } from "lucide-react"
import { AppIcon } from "./app-icon"
import { Stars } from "./stars"
import { timeAgo } from "@/lib/format"
import type { ReviewView } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface ReviewCardApp { slug: string; name: string; iconUrl: string | null }

/**
 * Visual review card for carousels and highlight grids. Read-only: voting, replying and reporting
 * live on the app page (ReviewItem). Every card links to the full review list of its app.
 */
export function ReviewCard({ review, app, showApp = true, className }: { review: ReviewView; app: ReviewCardApp; showApp?: boolean; className?: string }) {
  const href = `/apps/${app.slug}#reviews`
  return (
    <article className={cn("flex h-full flex-col rounded-3xl border border-border bg-card p-5 shadow-soft", className)}>
      {showApp && (
        <Link href={href} className="flex items-center gap-3 rounded-2xl">
          <AppIcon app={app} size="sm" />
          <span className="min-w-0"><span className="block truncate text-sm font-semibold">{app.name}</span><span className="block text-xs text-muted-foreground">Read all reviews</span></span>
        </Link>
      )}
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", showApp && "mt-4")}>
        {review.rating === null ? <span>No star rating</span> : <><Stars value={review.rating} size={14} /><span className="font-semibold text-foreground">{review.rating.toFixed(1)}</span></>}
        <span>· {timeAgo(review.createdAt)}</span>
        {review.isDemo && <span className="rounded-full border border-dashed border-border px-1.5">demo</span>}
      </div>
      {review.title && <h3 className="mt-2 line-clamp-1 font-semibold">{review.title}</h3>}
      <p className="mt-1.5 line-clamp-4 text-[15px] leading-relaxed text-foreground/90">{review.body}</p>
      <footer className="mt-auto flex items-center gap-2 pt-4 text-xs text-muted-foreground">
        <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-[11px] font-semibold text-foreground">
          {review.author.avatarUrl
            // eslint-disable-next-line @next/next/no-img-element -- remote avatar via the raster proxy
            ? <img src={`/api/media?url=${encodeURIComponent(review.author.avatarUrl)}`} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
            : review.author.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 truncate font-medium text-foreground">{review.author.name}</span>
        {review.verifiedUsage && <span className="inline-flex items-center gap-0.5 text-brand"><BadgeCheck className="size-3" />Verified usage</span>}
        <span className="ml-auto inline-flex shrink-0 items-center gap-1"><ThumbsUp className="size-3" />{review.helpfulCount}</span>
        {review.response && <span className="inline-flex shrink-0 items-center gap-0.5" title="The developer responded"><CornerDownRight className="size-3" />Reply</span>}
      </footer>
    </article>
  )
}
