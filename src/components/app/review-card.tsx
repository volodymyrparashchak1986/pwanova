import { CornerDownRight, ThumbsUp } from "lucide-react"
import { AppIcon } from "./app-icon"
import { Stars } from "./stars"
import { Link } from "@/components/i18n/link"
import type { Locale } from "@/i18n/config"
import type { Dictionary } from "@/i18n/dictionaries"
import { fmt, relativeTime } from "@/i18n/format"
import type { ReviewView } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface ReviewCardApp { slug: string; name: string; iconUrl: string | null }
export interface ReviewCardText { reviews: Dictionary["reviews"]; starsOf: string }

/**
 * Visual review card for carousels and highlight grids. Read-only: voting, replying and reporting
 * live on the app page (ReviewItem). Every card links to the full review list of its app.
 */
export function ReviewCard({ review, app, showApp = true, t, locale, className }: { review: ReviewView; app: ReviewCardApp; showApp?: boolean; t: ReviewCardText; locale: Locale; className?: string }) {
  const r = t.reviews
  return (
    <article className={cn("flex h-full flex-col rounded-3xl border border-border bg-card p-5 shadow-soft", className)}>
      {showApp && (
        <Link href={`/apps/${app.slug}#reviews`} className="flex items-center gap-3 rounded-2xl">
          <AppIcon app={app} size="sm" />
          <span className="min-w-0"><span className="block truncate text-sm font-semibold">{app.name}</span><span className="block text-xs text-muted-foreground">{r.readAll}</span></span>
        </Link>
      )}
      <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground", showApp && "mt-4")}>
        {review.rating === null
          ? <span>{r.noStars}</span>
          : <><Stars value={review.rating} size={14} label={fmt(t.starsOf, { value: review.rating })} /><span className="font-semibold text-foreground">{review.rating.toFixed(1)}</span></>}
        {/* the server and the browser may be a minute apart */}
        <span suppressHydrationWarning>· {relativeTime(locale, review.createdAt)}</span>
        {review.isDemo && <span className="rounded-full border border-dashed border-border px-1.5">{r.demo}</span>}
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
        <span className="ml-auto inline-flex shrink-0 items-center gap-1" title={r.helpful}><ThumbsUp className="size-3" aria-hidden />{review.helpfulCount}</span>
        {review.response && <span className="inline-flex shrink-0 items-center gap-0.5" title={r.developerResponse}><CornerDownRight className="size-3" aria-hidden />{r.reply}</span>}
      </footer>
    </article>
  )
}
