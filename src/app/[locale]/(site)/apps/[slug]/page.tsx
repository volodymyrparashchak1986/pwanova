import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { Bookmark, Eye, ShieldQuestion, Users } from "lucide-react"
import { AppActions } from "@/components/app/app-actions"
import { AppIcon } from "@/components/app/app-icon"
import { DemoChip, OwnershipBadge } from "@/components/app/badges"
import { Card, DataTable, Muted, PricingPlans, Section, TagList, Updates } from "@/components/app/detail/sections"
import { RateBox } from "@/components/app/rate-box"
import { RatingSummary } from "@/components/app/rating-summary"
import { ReviewForm } from "@/components/app/review-form"
import { ReviewHighlights } from "@/components/app/review-highlights"
import { ReviewItem } from "@/components/app/review-item"
import { Screenshots } from "@/components/app/screenshots"
import { PageShell } from "@/components/app/section-header"
import { RatingInline } from "@/components/app/stars"
import { ViewTracker } from "@/components/app/tracker"
import { AppRow } from "@/components/catalog/app-card"
import { PriceBadge } from "@/components/catalog/price-badge"
import { Link } from "@/components/i18n/link"
import { FactList } from "@/components/trust/fact-row"
import { TrustSnapshot } from "@/components/trust/trust-snapshot"
import { buttonVariants } from "@/components/ui/button"
import { isLocale, localizeHref } from "@/i18n/config"
import { countryName, fmt, formatDate, formatNumber, languageName, pick } from "@/i18n/format"
import { getI18n } from "@/i18n/server"
import { labelFor } from "@/lib/constants"
import { getRatingBreakdown, getReviews, getViewer } from "@/lib/data"
import { getViewerAppState } from "@/lib/data/account"
import { getActiveLaunchSlug, getAppDetail, getDuplicateTarget, getFactRegistry, getPublicSettings, getSimilarApps } from "@/lib/data/catalog"
import { siteUrl } from "@/lib/env"
import { jsonLd } from "@/lib/security/sanitize"
import { pageMetadata } from "@/lib/seo"
import { excerpt, localizedText } from "@/lib/v2/text"
import type { Dimension } from "@/lib/v2/types"
import { cn } from "@/lib/utils"

type Props = PageProps<"/[locale]/apps/[slug]">

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const detail = await getAppDetail(slug)
  if (!detail) return { robots: { index: false, follow: false } }
  const { app } = detail
  const text = localizedText(app, locale)
  return pageMetadata({
    locale, path: `/apps/${app.slug}`, title: `${app.name} — ${text.tagline}`, description: excerpt(text.description || text.tagline),
    index: !app.isDemo, // fabricated sample listings never reach a search engine
  })
}

const DIMENSIONS: Dimension[] = ["company", "data", "ai", "technical", "product"]

export default async function AppPage({ params, searchParams }: Props) {
  const [{ slug }, sp, { t, locale }] = await Promise.all([params, searchParams, getI18n()])
  const from = typeof sp.from === "string" && /^[a-z_]{1,20}$/.test(sp.from) ? sp.from : undefined
  const detail = await getAppDetail(slug)
  if (!detail) {
    // a merged duplicate keeps its address: it points at the listing that stayed
    const target = await getDuplicateTarget(slug)
    if (target) permanentRedirect(localizeHref(`/apps/${target}`, locale))
    notFound()
  }
  const { app } = detail
  const viewer = await getViewer()
  const [registry, breakdown, reviews, state, similar, settings, launchSlug] = await Promise.all([
    getFactRegistry(), getRatingBreakdown(app), getReviews(app, viewer?.id), getViewerAppState(app.id, viewer?.id ?? null),
    getSimilarApps(app, 4), getPublicSettings(), getActiveLaunchSlug(app.id),
  ])
  const isOwner = Boolean(viewer && app.developer.id === viewer.id)
  const canRespond = isOwner && app.ownershipStatus === "verified_owner"
  const myReview = viewer ? reviews.find((r) => r.userId === viewer.id) ?? null : null
  const text = localizedText(app, locale)
  const categoryName = app.category ? pick(app.category.name, locale) : null
  const country = app.company?.countryCode ? countryName(locale, app.company.countryCode) : null

  // Structured data describes what is documented. No rating without real ratings, no price without a stated price,
  // and nothing at all for a fabricated sample listing.
  const offer = app.pricingModel === "free" || app.pricingModel === "open_source"
    ? { "@type": "Offer", price: "0", priceCurrency: app.priceCurrency ?? "EUR" }
    : app.startingPriceCents !== null && app.priceCurrency
      ? { "@type": "Offer", price: (app.startingPriceCents / 100).toFixed(2), priceCurrency: app.priceCurrency }
      : null
  const ld = app.isDemo ? null : {
    "@context": "https://schema.org", "@type": "SoftwareApplication", name: app.name, description: text.description || text.tagline,
    url: `${siteUrl}/${locale}/apps/${app.slug}`, sameAs: app.url, inLanguage: text.lang,
    ...(categoryName && { applicationCategory: categoryName }),
    operatingSystem: app.platforms.length ? app.platforms.map((p) => t.filters.platforms[p]).join(", ") : "Web",
    ...(offer && { offers: offer }),
    ...(app.ratingsCount > 0 && { aggregateRating: { "@type": "AggregateRating", ratingValue: app.rating, ratingCount: app.ratingsCount, bestRating: 5, worstRating: 1 } }),
    ...(app.company && { publisher: { "@type": "Organization", name: app.company.name, ...(app.company.countryCode && { address: { "@type": "PostalAddress", addressCountry: app.company.countryCode } }) } }),
  }
  const breadcrumbs = app.isDemo || !app.category ? null : {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t.categories.title, item: `${siteUrl}/${locale}/categories` },
      { "@type": "ListItem", position: 2, name: categoryName, item: `${siteUrl}/${locale}/categories/${app.category.slug}` },
      { "@type": "ListItem", position: 3, name: app.name, item: `${siteUrl}/${locale}/apps/${app.slug}` },
    ],
  }
  const detailAttrs = (d: Dimension) => registry.filter((a) => a.dimension === d)

  return (
    <PageShell>
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />}
      {breadcrumbs && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} />}
      <ViewTracker appId={app.id} from={from} />

      {app.category && (
        <nav aria-label={t.common.breadcrumb} className="mb-4 text-sm text-muted-foreground">
          <Link href="/categories" className="hover:text-foreground">{t.categories.title}</Link> / <Link href={`/categories/${app.category.slug}`} className="hover:text-foreground">{categoryName}</Link>
        </nav>
      )}

      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <AppIcon app={app} size="xl" className="mx-auto sm:mx-0" />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h1 className="text-3xl font-semibold tracking-tight text-balance md:text-5xl">{app.name}</h1>
          <p className="mt-1.5 text-lg text-muted-foreground" lang={text.lang !== locale ? text.lang : undefined}>{text.tagline}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {app.company ? <span className="font-medium text-foreground">{app.company.name}</span> : app.developer.username ? <Link href={`/developers/${app.developer.username}`} className="font-medium text-foreground hover:underline">{app.developer.name}</Link> : null}
            {country && <> · {country}{app.company?.inEu !== null && app.company?.inEu !== undefined && <> ({app.company.inEu ? t.app.insideEu : t.app.outsideEu})</>}</>}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 sm:justify-start">
            <OwnershipBadge status={app.ownershipStatus} t={t.card} showUnverified />
            {app.isDemo && <DemoChip t={t.common} />}
            <RatingInline rating={app.rating} count={app.ratingsCount} locale={locale} t={t.card} className="text-sm" />
            <PriceBadge app={app} t={t.card} locale={locale} className="text-sm" />
            {launchSlug && <Link href={`/launches/${launchSlug}`} className="text-sm font-medium text-brand hover:underline">{t.app.viewLaunch}</Link>}
          </div>
          <div id="install" className="mt-5 flex scroll-mt-24 justify-center sm:justify-start">
            <AppActions app={app} signedIn={Boolean(viewer)} saved={state.favorited} following={state.following} from={from} compareEnabled={settings.features.compare} />
          </div>
        </div>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          <TrustSnapshot app={app} facts={detail.facts} registry={registry} t={t} locale={locale} />

          <Section id="overview" title={t.app.overview}>
            <p className="text-[17px] leading-relaxed whitespace-pre-line text-foreground/90" lang={text.lang !== locale ? text.lang : undefined}>{text.description || text.tagline}</p>
            {text.original && <p className="mt-2 text-xs text-muted-foreground">{t.app.descriptionOriginal}</p>}
            {detail.useCases.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label={t.app.useCases}>
                {detail.useCases.map((u) => <li key={u.slug}><Link href={`/discover?use=${u.slug}`} className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground hover:text-foreground">{pick(u.name, locale)}</Link></li>)}
              </ul>
            )}
          </Section>

          <Section id="screenshots" title={t.app.screenshots}><Screenshots app={{ ...app, screenshots: detail.screenshots }} emptyLabel={t.app.noScreenshots} /></Section>

          <Section id="trust-profile" title={t.app.trustProfile} aside={<Link href={`/apps/${app.slug}/evidence`} className="text-sm font-medium text-brand hover:underline">{t.trust.history}</Link>}>
            <div className="grid gap-4 md:grid-cols-2">
              {DIMENSIONS.map((d) => {
                const attrs = detailAttrs(d)
                if (!attrs.length) return null
                return <Card key={d} className={cn(d === "technical" && "md:col-span-2")}><h3 className="text-base font-semibold">{t.trust.dimensions[d]}</h3><FactList attrs={attrs} facts={detail.facts} t={t.trust} locale={locale} /></Card>
              })}
            </div>
            <div className="mt-4"><DataTable detail={detail} t={t} locale={locale} /></div>
            <p className="mt-3 text-xs text-muted-foreground">{t.trust.notACertificate} <Link href="/verification-methodology" className="font-medium text-brand hover:underline">{t.footer.links.methodology}</Link></p>
          </Section>

          <Section id="pricing" title={t.app.pricing}><PricingPlans plans={detail.pricingPlans} t={t} locale={locale} /></Section>

          <Section id="integrations" title={t.app.integrations}>
            <TagList items={detail.integrations.map((i) => ({ ...i, key: i.slug, label: i.name }))} t={t.trust} locale={locale} empty={t.app.noIntegrations} />
          </Section>

          <Section id="updates" title={t.app.updates}><Updates updates={detail.updates} t={t} locale={locale} /></Section>

          {(detail.alternativeTo.length > 0 || similar.length > 0) && (
            <Section id="alternatives" title={t.app.alternatives}>
              {detail.alternativeTo.length > 0 && (
                <p className="mb-4 text-sm text-muted-foreground">{t.app.alternativeTo}{" "}
                  {detail.alternativeTo.map((a, i) => <span key={a.slug}>{i > 0 && ", "}<Link href={`/alternatives/${a.slug}`} className="font-medium text-foreground hover:underline">{a.name}</Link></span>)}
                </p>
              )}
              {similar.length > 0 && (
                <>
                  {categoryName && <h3 className="mb-1 text-sm font-semibold text-muted-foreground">{fmt(t.app.moreIn, { category: categoryName })}</h3>}
                  <div className="-mx-2.5 grid sm:grid-cols-2">{similar.map((a) => <AppRow key={a.id} app={a} />)}</div>
                </>
              )}
            </Section>
          )}

          <Section id="reviews" title={t.app.reviews} aside={<Link href="/review-rules" className="text-sm text-muted-foreground underline-offset-2 hover:underline">{t.reviews.rules}</Link>}>
            <div className="grid gap-6 rounded-3xl border border-border bg-card p-5 md:grid-cols-2 md:p-6">
              <RatingSummary data={breakdown} t={t} locale={locale} />
              <div className="flex flex-col justify-center gap-4 md:border-l md:border-border md:pl-6">
                <RateBox appId={app.id} slug={app.slug} signedIn={Boolean(viewer)} isOwner={isOwner} initial={state.myRating} />
                {!isOwner && (
                  <ReviewForm viewerId={viewer?.id ?? null} key={myReview?.id ?? "new"} appId={app.id} slug={app.slug} signedIn={Boolean(viewer)}
                    defaultRating={state.myRating} existing={myReview ? { rating: myReview.rating, title: myReview.title, body: myReview.body } : null} />
                )}
              </div>
            </div>
            <ReviewHighlights reviews={reviews} app={app} t={t} locale={locale} />
            <div className="mt-5 space-y-3">
              {reviews.length ? reviews.map((r) => <ReviewItem key={r.id} review={r} slug={app.slug} viewerId={viewer?.id ?? null} canRespond={canRespond} />) : <Muted>{t.reviews.empty}</Muted>}
            </div>
          </Section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="p-5!">
            <dl className="grid gap-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">{t.app.website}</dt><dd className="truncate font-medium">{app.domain}</dd></div>
              {app.company && <div><dt className="text-xs text-muted-foreground">{t.app.company}</dt><dd className="font-medium">{app.company.name}{country ? ` · ${country}` : ""}</dd></div>}
              {app.developer.username && <div><dt className="text-xs text-muted-foreground">{t.app.developer}</dt><dd><Link href={`/developers/${app.developer.username}`} className="font-medium hover:underline">{app.developer.name}</Link></dd></div>}
              <div><dt className="text-xs text-muted-foreground">{t.app.platforms}</dt><dd className="mt-1"><TagList items={detail.platforms.map((p) => ({ ...p, key: p.platform, label: t.filters.platforms[p.platform] }))} t={t.trust} locale={locale} empty={t.common.notStated} /></dd></div>
              <div><dt className="text-xs text-muted-foreground">{t.app.languages}</dt><dd className="mt-1"><TagList items={detail.languages.map((l) => ({ ...l, key: l.code, label: languageName(locale, l.code) }))} t={t.trust} locale={locale} empty={t.app.noLanguages} /></dd></div>
              {app.hostingProvider !== "other" && app.hostingProvider !== "custom-domain" && <div><dt className="text-xs text-muted-foreground">{t.app.hostDetected}</dt><dd className="font-medium">{labelFor.host(app.hostingProvider)}</dd></div>}
              <div><dt className="text-xs text-muted-foreground">{t.app.listedSince}</dt><dd className="font-medium"><time dateTime={app.createdAt}>{formatDate(locale, app.createdAt)}</time></dd></div>
            </dl>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
              {([[Eye, app.opens30d, t.app.engagement.opens], [Bookmark, app.favoritesCount, t.app.engagement.saves], [Users, app.followersCount, t.app.engagement.followers]] as const).map(([Icon, n, label]) => (
                <div key={label}><Icon className="mx-auto size-4 text-muted-foreground" aria-hidden /><p className="mt-1 font-semibold tabular-nums">{formatNumber(locale, n)}</p><p className="text-[11px] leading-tight text-muted-foreground">{label}</p></div>
              ))}
            </div>
          </Card>

          {app.ownershipStatus !== "verified_owner" && (
            <Card className="bg-accent/50 p-5!">
              <ShieldQuestion className="size-6 text-brand" aria-hidden />
              <p className="mt-2 font-semibold">{t.app.claimTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{app.ownershipStatus === "unclaimed" ? t.app.claimBodyUnclaimed : t.app.claimBodyPending} {t.app.claimBenefits}</p>
              <Link href={`/apps/${app.slug}/claim`} className={cn(buttonVariants(), "mt-4 w-full rounded-full")}>{t.app.claimCta}</Link>
            </Card>
          )}
          {isOwner && <Link href={`/dashboard/apps/${app.slug}`} className={cn(buttonVariants({ variant: "outline" }), "w-full rounded-full")}>{t.dashboard.manage}</Link>}
        </aside>
      </div>
    </PageShell>
  )
}
