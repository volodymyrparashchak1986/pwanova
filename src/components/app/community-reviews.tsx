import Link from "next/link"
import { MessageSquareText, PenLine } from "lucide-react"
import { AppIcon } from "./app-icon"
import { ReviewCarousel } from "./review-carousel"
import { SectionHeader } from "./section-header"
import { buttonVariants } from "@/components/ui/button"
import type { CommunityReviews as CommunityReviewsData } from "@/lib/data"
import { cn } from "@/lib/utils"

/**
 * Home page section: real reviews of the top three apps, up to three per app, most helpful first.
 * With no reviews yet it says exactly that and points at the three apps instead of faking any.
 */
export function CommunityReviews({ data }: { data: CommunityReviewsData[] }) {
  if (!data.length) return null
  const items = data.flatMap(({ app, reviews }) => reviews.map((review) => ({ review, app: { slug: app.slug, name: app.name, iconUrl: app.iconUrl } })))
  const total = items.length

  return (
    <section className="mx-auto mt-20 max-w-6xl px-4" aria-labelledby="community-reviews-h">
      <SectionHeader title="What people say" sub={total ? `Reviews from signed-in members about the top ${data.length === 1 ? "app" : `${data.length} apps`}, most helpful first. Nothing here is fabricated.` : "Reviews come from signed-in people only, so the first ones will be real."} href="/top" cta="Top apps" />
      <h2 id="community-reviews-h" className="sr-only">Community reviews</h2>
      {total ? (
        <ReviewCarousel items={items} />
      ) : (
        <div className="grid gap-4 rounded-3xl border border-dashed border-border p-5 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex items-start gap-3">
            <MessageSquareText className="mt-0.5 size-5 shrink-0 text-brand" />
            <div>
              <p className="font-semibold">No reviews yet</p>
              <p className="mt-1 text-sm text-muted-foreground">The top apps are waiting for their first honest review. Sign in, try one, and tell others what you think.</p>
            </div>
          </div>
          <ul className="flex flex-wrap gap-2">
            {data.map(({ app }) => (
              <li key={app.id}>
                <Link href={`/apps/${app.slug}#reviews`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}>
                  <AppIcon app={app} size="sm" className="-ml-2 size-6! rounded-md!" />{app.name}<PenLine className="size-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
