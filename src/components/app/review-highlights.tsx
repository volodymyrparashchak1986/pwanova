import { ReviewCard } from "./review-card"
import type { Locale } from "@/i18n/config"
import type { Dictionary } from "@/i18n/dictionaries"
import { pickReviewHighlights } from "@/lib/reviews"
import type { ReviewView } from "@/lib/types"

/** "Most helpful" strip on an app page: up to three cards, only when there are more reviews than fit the strip. */
export function ReviewHighlights({ reviews, app, t, locale }: { reviews: ReviewView[]; app: { id: string; slug: string; name: string; iconUrl: string | null }; t: Dictionary; locale: Locale }) {
  const visible = reviews.filter((r) => !r.hiddenAt)
  if (visible.length <= 3) return null
  const top = pickReviewHighlights(visible, [app.id], 3).get(app.id) ?? []
  if (!top.length) return null
  return (
    <div className="mt-5">
      <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{t.reviews.mostHelpful}</h3>
      <div className="grid gap-4 md:grid-cols-3">
        {top.map((r) => <ReviewCard key={r.id} review={r} app={app} showApp={false} t={{ reviews: t.reviews, starsOf: t.common.starsOf }} locale={locale} />)}
      </div>
    </div>
  )
}
