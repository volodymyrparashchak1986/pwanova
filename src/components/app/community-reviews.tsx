import { MessageSquareText, PenLine } from "lucide-react"
import { AppIcon } from "./app-icon"
import { ReviewCarousel } from "./review-carousel"
import { SectionHeader } from "./section-header"
import { Link } from "@/components/i18n/link"
import { buttonVariants } from "@/components/ui/button"
import { getI18n } from "@/i18n/server"
import type { CommunityReviews as CommunityReviewsData } from "@/lib/data"
import { cn } from "@/lib/utils"

/**
 * Home page section: real reviews of the top three apps, up to three per app, most helpful first.
 * With no reviews yet it says exactly that and points at the three apps instead of faking any.
 */
export async function CommunityReviews({ data }: { data: CommunityReviewsData[] }) {
  if (!data.length) return null
  const { t } = await getI18n()
  const items = data.flatMap(({ app, reviews }) => reviews.map((review) => ({ review, app: { slug: app.slug, name: app.name, iconUrl: app.iconUrl } })))

  return (
    <section className="mx-auto mt-20 max-w-7xl px-4" aria-labelledby="community-reviews-h">
      <SectionHeader id="community-reviews-h" title={t.reviews.communityTitle} sub={items.length ? t.reviews.communityBody : t.reviews.communityEmpty} href="/discover?sort=rating" cta={t.filters.sorts.rating} />
      {items.length ? (
        <ReviewCarousel items={items} />
      ) : (
        <div className="grid gap-4 rounded-3xl border border-dashed border-border p-5 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex items-start gap-3">
            <MessageSquareText className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
            <div>
              <p className="font-semibold">{t.reviews.communityEmptyTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t.reviews.communityEmptyBody}</p>
            </div>
          </div>
          <ul className="flex flex-wrap gap-2">
            {data.map(({ app }) => (
              <li key={app.id}>
                <Link href={`/apps/${app.slug}#reviews`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}>
                  <AppIcon app={app} size="sm" className="-ml-2 size-6! rounded-md!" />{app.name}<PenLine className="size-3.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
