import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ShieldQuestion, Activity, Bookmark, MousePointerClick, Eye } from "lucide-react"
import { AppIcon } from "@/components/app/app-icon"
import { AppActions } from "@/components/app/app-actions"
import { BuiltWithBadge, DemoChip, HostBadge, LaunchBadge, VerifiedBadge } from "@/components/app/badges"
import { QualityPanel } from "@/components/app/quality-panel"
import { RateBox } from "@/components/app/rate-box"
import { RatingSummary } from "@/components/app/rating-summary"
import { ReviewForm } from "@/components/app/review-form"
import { ReviewItem } from "@/components/app/review-item"
import { Screenshots } from "@/components/app/screenshots"
import { Stars } from "@/components/app/stars"
import { ViewTracker } from "@/components/app/tracker"
import { PageShell } from "@/components/app/section-header"
import { buttonVariants } from "@/components/ui/button"
import { getAppBySlug, getRatingBreakdown, getReviews, getViewer, getViewerAppState } from "@/lib/data"
import { labelFor } from "@/lib/constants"
import { formatCount } from "@/lib/format"
import { siteUrl } from "@/lib/env"
import { jsonLd } from "@/lib/security/sanitize"
import { cn } from "@/lib/utils"

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const app = await getAppBySlug(slug)
  if (!app) return { title: "App not found" }
  const title = `${app.name} — ${app.tagline}`
  const description = app.description.slice(0, 160) || app.tagline
  const url = `/apps/${app.slug}`
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title, description, siteName: "PWANova" },
    twitter: { card: "summary_large_image", title, description },
    robots: app.isDemo ? { index: false, follow: true } : undefined,
  }
}

export default async function AppPage({ params, searchParams }: Props) {
  const [{ slug }, { from }] = await Promise.all([params, searchParams])
  const app = await getAppBySlug(slug)
  if (!app) notFound()
  const viewer = await getViewer()
  const [breakdown, reviews, state] = await Promise.all([getRatingBreakdown(app), getReviews(app, viewer?.id), getViewerAppState(app.id, viewer?.id ?? null)])
  const isOwner = Boolean(viewer && app.developer.id === viewer.id)
  const canRespond = isOwner && app.ownershipStatus === "verified_owner"
  const myReview = viewer ? reviews.find((r) => r.userId === viewer.id) ?? null : null

  const ld = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: app.name,
    description: app.description || app.tagline,
    url: `${siteUrl}/apps/${app.slug}`,
    applicationCategory: labelFor.category(app.category),
    operatingSystem: "Any (web)",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    ...(app.ratingsCount > 0 && { aggregateRating: { "@type": "AggregateRating", ratingValue: app.rating, ratingCount: app.ratingsCount, bestRating: 5, worstRating: 1 } }),
    ...(app.developer.name && { author: { "@type": app.developer.username ? "Person" : "Organization", name: app.developer.name } }),
  }

  return (
    <PageShell className="max-w-4xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <ViewTracker appId={app.id} from={from} />

      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <AppIcon app={app} size="xl" className="mx-auto sm:mx-0" />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{app.name}</h1>
          <p className="mt-1.5 text-lg text-muted-foreground">{app.tagline}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            <Link href={`/categories/${app.category}`} className="font-medium text-foreground hover:underline">{labelFor.category(app.category)}</Link>
            {app.developer.username && <> · by <Link href={`/developers/${app.developer.username}`} className="font-medium text-foreground hover:underline">{app.developer.name}</Link></>}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
            <VerifiedBadge app={app} />
            <BuiltWithBadge tool={app.buildTool} linked />
            <HostBadge host={app.hostingProvider} linked />
            <LaunchBadge source={app.launchSource} linked />
            {app.isDemo && <DemoChip />}
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 sm:justify-start">
            <span className="text-2xl font-semibold tabular-nums">{app.ratingsCount ? app.rating.toFixed(1) : "–"}</span>
            <Stars value={app.rating} size={16} />
            <span className="text-sm text-muted-foreground">{formatCount(app.ratingsCount)} {app.ratingsCount === 1 ? "rating" : "ratings"}</span>
          </div>
          <div className="mt-5 flex justify-center sm:justify-start">
            <AppActions app={app} signedIn={Boolean(viewer)} saved={state.favorited} from={from} />
          </div>
        </div>
      </header>

      {app.ownershipStatus !== "verified_owner" && (
        <div className="mt-8 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-accent/50 p-4">
          <ShieldQuestion className="size-6 text-brand" />
          <div className="min-w-0 flex-1"><p className="font-semibold">Is this your app?</p><p className="text-sm text-muted-foreground">{app.ownershipStatus === "unclaimed" ? "This listing hasn't been claimed yet." : "The owner of this listing hasn't verified ownership."} Claim it to respond to reviews, see analytics and earn PWANova Verified.</p></div>
          <Link href={`/apps/${app.slug}/claim`} className={cn(buttonVariants({ variant: "default" }), "rounded-full")}>Claim this app</Link>
        </div>
      )}

      <section className="mt-10" aria-label="Screenshots"><Screenshots app={app} /></section>

      <section className="mt-10 grid gap-8 md:grid-cols-[1fr_16rem]">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">About</h2>
          <p className="mt-3 whitespace-pre-line text-[17px] leading-relaxed text-foreground/90">{app.description || app.tagline}</p>
        </div>
        <dl className="grid content-start gap-3 rounded-3xl border border-border bg-card p-5 text-sm">
          <div><dt className="text-xs text-muted-foreground">Website</dt><dd className="truncate font-medium">{app.domain}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Ownership</dt><dd className="font-medium capitalize">{app.ownershipStatus.replace("_", " ")}</dd></div>
          {app.launchSource && <div><dt className="text-xs text-muted-foreground">{app.launchSource.type === "launched_on" ? "Launched on" : "Discovered via"}</dt><dd className="font-medium">{app.launchSource.url ? <a className="hover:underline" href={app.launchSource.url} rel="noopener noreferrer nofollow" target="_blank">{app.launchSource.name}</a> : app.launchSource.name}</dd></div>}
          <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
            <div><Eye className="mx-auto size-4 text-muted-foreground" /><p className="mt-1 font-semibold">{formatCount(app.opens30d)}</p><p className="text-[11px] text-muted-foreground">Opens · 30d</p></div>
            <div><MousePointerClick className="mx-auto size-4 text-muted-foreground" /><p className="mt-1 font-semibold">{formatCount(app.installActions)}</p><p className="text-[11px] text-muted-foreground">Install actions</p></div>
            <div><Bookmark className="mx-auto size-4 text-muted-foreground" /><p className="mt-1 font-semibold">{formatCount(app.favoritesCount)}</p><p className="text-[11px] text-muted-foreground">Saved</p></div>
          </div>
        </dl>
      </section>

      <section className="mt-10"><QualityPanel app={app} /></section>

      <section className="mt-12" id="reviews" aria-labelledby="ratings-h">
        <h2 id="ratings-h" className="text-2xl font-semibold tracking-tight">Ratings &amp; Reviews</h2>
        <div className="mt-5 grid gap-6 rounded-3xl border border-border bg-card p-5 md:grid-cols-2 md:p-6">
          <RatingSummary data={breakdown} />
          <div className="flex flex-col justify-center gap-4 md:border-l md:border-border md:pl-6">
            <RateBox appId={app.id} slug={app.slug} signedIn={Boolean(viewer)} isOwner={isOwner} initial={state.myRating} />
            {viewer && !isOwner && <ReviewForm key={myReview?.id ?? "new"} appId={app.id} defaultRating={state.myRating} existing={myReview ? { rating: myReview.rating, title: myReview.title, body: myReview.body } : null} />}
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {reviews.length ? reviews.map((r) => <ReviewItem key={r.id} review={r} slug={app.slug} viewerId={viewer?.id ?? null} canRespond={canRespond} />)
            : <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No reviews yet. Be the first to share what you think.</p>}
        </div>
      </section>

      <p className="mt-10 flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><Activity className="size-3.5" />Listing data is provided by the developer and checked automatically. <Link href={`/embed/app/${app.slug}`} className="underline">Embed badge</Link></p>
    </PageShell>
  )
}
