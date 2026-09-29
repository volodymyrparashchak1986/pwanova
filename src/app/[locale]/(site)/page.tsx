import type { Metadata } from "next"
import { ArrowRight, BadgeCheck, FileSearch, Scale, Search } from "lucide-react"
import { CommunityReviews } from "@/components/app/community-reviews"
import { SectionHeader } from "@/components/app/section-header"
import { AppCard } from "@/components/catalog/app-card"
import { CategoryIcon } from "@/components/catalog/category-icon"
import { Link } from "@/components/i18n/link"
import { LaunchCard } from "@/components/launches/launch-card"
import { buttonVariants } from "@/components/ui/button"
import { fmt, formatNumber, pick, plural } from "@/i18n/format"
import { getDictionary, getI18n } from "@/i18n/server"
import { isLocale } from "@/i18n/config"
import { getCommunityReviews, getViewer } from "@/lib/data"
import { getSavedIds } from "@/lib/data/account"
import {
  getCategories, getEditorsPicks, getEuropeanAlternatives, getFacetCounts, getFactRegistry, getLaunches, getNewestApps, getPopular,
  getPublicSettings, getRecentlyVerified, getSponsorSlots,
} from "@/lib/data/catalog"
import { jsonLd } from "@/lib/security/sanitize"
import { pageMetadata } from "@/lib/seo"
import { siteUrl } from "@/lib/env"
import { factLabel } from "@/lib/v2/trust"
import { cn } from "@/lib/utils"

/** Entry points by fact. A chip is only shown when at least one listing documents the fact. */
const TRUST_ENTRIES = ["eu_company", "eu_hosting_available", "dpa_available", "no_training_on_customer_data", "open_source", "self_hosted", "mcp_available", "api_available", "pwa_manifest", "german_available", "free_plan"]
const entryHref = (key: string) => (key === "eu_company" ? "/discover?eu=1" : key === "free_plan" ? "/discover?free=1" : `/discover?fact=${key}`)

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return pageMetadata({ locale, path: "/", title: `${t.common.siteName} — ${t.home.metaTitle}`, description: t.home.body, absoluteTitle: true })
}

export default async function HomePage() {
  const [{ t, locale, href }, viewer, settings] = await Promise.all([getI18n(), getViewer(), getPublicSettings()])
  const [facets, registry, categories, verified, picks, newest, launches, alternatives, popular, community, sponsors, saved] = await Promise.all([
    getFacetCounts(), getFactRegistry(), getCategories(), getRecentlyVerified(6), getEditorsPicks(6), getNewestApps(6),
    settings.features.launches ? getLaunches({ current: true, limit: 4 }) : Promise.resolve([]),
    getEuropeanAlternatives(6), locale === "de" ? getPopular("de", 6) : Promise.resolve([]), getCommunityReviews(3, 3),
    getSponsorSlots("home"), getSavedIds(viewer?.id ?? null),
  ])
  const signedIn = Boolean(viewer)
  const entries = TRUST_ENTRIES
    .map((key) => ({ key, attr: registry.find((a) => a.key === key), count: key === "eu_company" ? facets.euCompany : key === "free_plan" ? Math.max(facets.freePlan, facets.facts[key] ?? 0) : facets.facts[key] ?? 0 }))
    .filter((e) => e.attr && e.count > 0)
  const topCategories = [...categories].filter((c) => c.count > 0).sort((a, b) => b.count - a.count).slice(0, 12)
  const shownCategories = topCategories.length >= 4 ? topCategories : categories.slice(0, 12)
  const pickIds = new Set(picks.map((p) => p.id))
  const fresh = newest.filter((a) => !pickIds.has(a.id)).slice(0, 6)

  const website = {
    "@context": "https://schema.org", "@type": "WebSite", name: t.common.siteName, url: `${siteUrl}/${locale}`, inLanguage: locale,
    potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${siteUrl}/${locale}/discover?q={search_term_string}` }, "query-input": "required name=search_term_string" },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(website) }} />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[520px] max-w-5xl rounded-full bg-brand-gradient opacity-20 blur-[120px]" />
        <div className="relative mx-auto max-w-4xl px-4 pt-12 pb-14 text-center md:pt-20 md:pb-20">
          <p className="animate-rise mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-brand-gradient" /> {t.home.eyebrow}
          </p>
          <h1 className="animate-rise mt-6 text-4xl font-semibold tracking-tight text-balance [animation-delay:60ms] sm:text-5xl md:text-6xl">
            {t.home.titleLead} <span className="text-brand-gradient">{t.home.titleHighlight}</span>
          </h1>
          <p className="animate-rise mx-auto mt-5 max-w-2xl text-lg text-balance text-muted-foreground [animation-delay:120ms]">{t.home.body}</p>
          <form action={href("/discover")} role="search" className="animate-rise mx-auto mt-8 flex max-w-2xl items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-5 shadow-soft [animation-delay:180ms]">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input name="q" type="search" maxLength={80} placeholder={t.nav.searchPlaceholder} aria-label={t.home.searchLabel} className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground" />
            <button type="submit" className={cn(buttonVariants(), "h-11 rounded-full px-5")}>{t.common.search}</button>
          </form>
          <ul className="animate-rise mt-4 flex flex-wrap items-center justify-center gap-2 text-sm [animation-delay:220ms]">
            <li className="text-muted-foreground">{t.home.tryLabel}:</li>
            {t.home.examples.map((q) => (
              <li key={q}><Link href={`/discover?q=${encodeURIComponent(q)}`} className="rounded-full border border-border bg-card/70 px-3 py-1 text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground">{q}</Link></li>
            ))}
          </ul>
          <div className="animate-rise mt-8 flex flex-wrap items-center justify-center gap-3 [animation-delay:260ms]">
            <Link href="/discover" className={cn(buttonVariants({ size: "lg" }), "rounded-full")}>{t.home.ctaExplore} <ArrowRight className="size-4" aria-hidden /></Link>
            {settings.features.requests && <Link href="/requests/new" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "rounded-full")}>{t.home.ctaRequest}</Link>}
          </div>
        </div>
      </section>

      {/* START FROM A FACT */}
      {entries.length > 0 && (
        <section className="mx-auto max-w-7xl px-4" aria-labelledby="trust-entries-h">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
            <h2 id="trust-entries-h" className="text-xl font-semibold tracking-tight md:text-2xl">{t.home.trustTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground md:text-base">{t.home.trustBody}</p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {entries.map(({ key, attr, count }) => (
                <li key={key}>
                  <Link href={entryHref(key)} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-brand/40 hover:text-brand">
                    {factLabel(attr!, "yes", locale)}<span className="text-xs font-normal tabular-nums text-muted-foreground">{formatNumber(locale, count)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* SPONSORED: separate block, always labelled, never mixed into organic lists */}
      {sponsors.some((s) => s.app) && (
        <section className="mx-auto mt-16 max-w-7xl px-4" aria-label={t.home.sponsoredTitle}>
          <div className="grid gap-4 sm:grid-cols-2">{sponsors.filter((s) => s.app).map((s) => <AppCard key={s.id} app={s.app!} sponsored from="home" signedIn={signedIn} saved={saved.has(s.app!.id)} note={pick(s.headline, locale) || undefined} />)}</div>
        </section>
      )}

      {verified.length > 0 && (
        <section className="mx-auto mt-16 max-w-7xl px-4" aria-labelledby="verified-h">
          <SectionHeader id="verified-h" title={t.home.verifiedTitle} sub={t.home.verifiedBody} href="/discover?sort=recently_verified" cta={t.common.seeAll} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{verified.map((a) => <AppCard key={a.id} app={a} from="home" signedIn={signedIn} saved={saved.has(a.id)} />)}</div>
        </section>
      )}

      {picks.length > 0 && (
        <section className="mx-auto mt-16 max-w-7xl px-4" aria-labelledby="picks-h">
          <SectionHeader id="picks-h" title={t.home.picksTitle} sub={t.home.picksBody} href="/how-ranking-works" cta={t.discover.organicLink} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{picks.map((a) => <AppCard key={a.id} app={a} editorsPick from="home" signedIn={signedIn} saved={saved.has(a.id)} />)}</div>
        </section>
      )}

      {settings.features.launches && (
        <section className="mx-auto mt-16 max-w-7xl px-4" aria-labelledby="launches-h">
          <SectionHeader id="launches-h" title={t.home.launchesTitle} sub={t.home.launchesBody} href="/launches" cta={t.common.seeAll} />
          {launches.length ? (
            <div className="grid gap-4 lg:grid-cols-2">{launches.map((l) => <LaunchCard key={l.id} launch={l} />)}</div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-dashed border-border p-5">
              <p className="text-sm text-muted-foreground">{t.home.launchesEmpty}</p>
              <Link href="/launches" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}>{t.home.launchesCta}</Link>
            </div>
          )}
        </section>
      )}

      {alternatives.length > 0 && (
        <section className="mx-auto mt-16 max-w-7xl px-4" aria-labelledby="alternatives-h">
          <SectionHeader id="alternatives-h" title={t.home.alternativesTitle} sub={t.home.alternativesBody} href="/discover?eu=1" cta={t.common.seeAll} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {alternatives.map(({ app, alternativeTo }) => <AppCard key={app.id} app={app} from="home" signedIn={signedIn} saved={saved.has(app.id)} note={alternativeTo[0] ? fmt(t.home.alternativeTo, { name: alternativeTo[0].name }) : undefined} />)}
          </div>
        </section>
      )}

      {popular.length > 0 && (
        <section className="mx-auto mt-16 max-w-7xl px-4" aria-labelledby="popular-h">
          <SectionHeader id="popular-h" title={t.home.popularTitle} sub={t.home.popularBody} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{popular.map((a) => <AppCard key={a.id} app={a} from="home" signedIn={signedIn} saved={saved.has(a.id)} />)}</div>
        </section>
      )}

      {fresh.length > 0 && (
        <section className="mx-auto mt-16 max-w-7xl px-4" aria-labelledby="newest-h">
          <SectionHeader id="newest-h" title={t.home.newestTitle} sub={t.home.newestBody} href="/discover?sort=new" cta={t.common.seeAll} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{fresh.map((a) => <AppCard key={a.id} app={a} from="home" signedIn={signedIn} saved={saved.has(a.id)} />)}</div>
        </section>
      )}

      {/* CATEGORIES */}
      {shownCategories.length > 0 && (
        <section className="mx-auto mt-16 max-w-7xl px-4" aria-labelledby="categories-h">
          <SectionHeader id="categories-h" title={t.home.categoriesTitle} href="/categories" cta={t.common.seeAll} />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {shownCategories.map((c) => (
              <li key={c.slug}>
                <Link href={`/categories/${c.slug}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-brand/40">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand"><CategoryIcon name={c.icon} className="size-5" /></span>
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold">{pick(c.name, locale)}</span><span className="block text-xs text-muted-foreground">{plural(locale, c.count, t.categories.count)}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* REVIEWS: real reviews of the top three apps, up to three each */}
      <CommunityReviews data={community} />

      {/* REQUEST + MAKERS */}
      <section className="mx-auto mt-20 grid max-w-7xl gap-4 px-4 lg:grid-cols-2">
        {settings.features.requests && (
          <div className="relative overflow-hidden rounded-[2rem] bg-[oklch(0.17_0.03_275)] p-6 text-white sm:p-8 md:p-10">
            <div aria-hidden className="absolute -top-24 -right-24 size-80 rounded-full bg-brand-gradient opacity-40 blur-[90px]" />
            <div className="relative">
              <h2 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">{t.home.requestTitle}</h2>
              <p className="mt-3 text-white/75">{t.home.requestBody}</p>
              <ul className="mt-5 space-y-2 text-sm text-white/85">{t.home.requestPoints.map((p) => <li key={p} className="flex items-start gap-2"><BadgeCheck className="mt-0.5 size-4 shrink-0 text-[oklch(0.8_0.13_215)]" aria-hidden />{p}</li>)}</ul>
              <Link href="/requests/new" className={cn(buttonVariants({ size: "lg", variant: "secondary" }), "mt-7 rounded-full bg-white text-[oklch(0.17_0.03_275)] hover:bg-white/90 hover:text-[oklch(0.17_0.03_275)]")}>{t.home.requestCta}</Link>
            </div>
          </div>
        )}
        <div className={cn("rounded-[2rem] border border-border bg-card p-6 shadow-soft sm:p-8 md:p-10", !settings.features.requests && "lg:col-span-2")}>
          <h2 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">{t.home.makersTitle}</h2>
          <p className="mt-3 text-muted-foreground">{t.home.makersBody}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/submit" className={cn(buttonVariants({ size: "lg" }), "rounded-full")}>{t.home.makersCta}</Link>
            <Link href="/for-makers" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "rounded-full")}>{t.home.makersSecondary}</Link>
          </div>
        </div>
      </section>

      {/* PRINCIPLES */}
      <section className="mx-auto mt-20 max-w-7xl px-4" aria-labelledby="principles-h">
        <h2 id="principles-h" className="text-2xl font-semibold tracking-tight md:text-3xl">{t.home.principlesTitle}</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {t.home.principles.map((p, i) => {
            const Icon = [FileSearch, BadgeCheck, Scale][i] ?? FileSearch
            const link = ["/verification-methodology", "/verification-methodology", "/how-ranking-works"][i]
            return (
              <div key={p.title} className="rounded-3xl border border-border bg-card p-6">
                <Icon className="size-6 text-brand" aria-hidden />
                <h3 className="mt-4 text-lg font-semibold">{p.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{p.body}</p>
                {link && <Link href={link} className="mt-3 inline-flex items-center text-sm font-medium text-brand hover:underline">{t.common.learnMore}<ArrowRight className="ml-1 size-4" aria-hidden /></Link>}
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}
