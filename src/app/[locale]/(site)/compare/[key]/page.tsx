import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { AppIcon } from "@/components/app/app-icon"
import { OwnershipBadge } from "@/components/app/badges"
import { PageHeader, PageShell } from "@/components/app/section-header"
import { RatingInline } from "@/components/app/stars"
import { CompareAdd, CompareRemove, CompareSync, CompareToolbar } from "@/components/compare/compare-controls"
import { Link } from "@/components/i18n/link"
import { answerLabel } from "@/components/trust/fact-row"
import { TrustSignal, VerificationStatus } from "@/components/trust/trust-signal"
import { isLocale, localizeHref, type Locale } from "@/i18n/config"
import type { Dictionary } from "@/i18n/dictionaries"
import { countryName, fmt, formatDate, formatNumber, formatPrice, languageName, pick } from "@/i18n/format"
import { getDictionary, getI18n } from "@/i18n/server"
import { getViewer } from "@/lib/data"
import { getCatalogBySlugs, getFactRegistry, getIntegrationCatalog, getPublicSettings, getPublicSlugs, getUseCases } from "@/lib/data/catalog"
import { pageMetadata } from "@/lib/seo"
import { comparisonCandidates, comparisonKey, comparisonSlugs, isIndexableComparison, parseComparisonKey } from "@/lib/v2/compare"
import { priceSummary } from "@/lib/v2/trust"
import type { CatalogApp, Dimension, FactAttribute } from "@/lib/v2/types"

type Props = PageProps<"/[locale]/compare/[key]">

/** The public apps an address names, in canonical order. What is not a public listing is left out. */
async function resolve(key: string): Promise<CatalogApp[]> {
  const known = await getPublicSlugs(comparisonCandidates(key))
  if (!known.size) return []
  return getCatalogBySlugs(comparisonSlugs(parseComparisonKey(key, known).filter((slug) => known.has(slug))))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, key } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  const apps = await resolve(decodeURIComponent(key))
  if (apps.length < 2) return { title: t.compare.title, robots: { index: false, follow: true } }
  const names = apps.map((a) => a.name).join(` ${t.compare.vs} `)
  return pageMetadata({
    locale, path: `/compare/${comparisonKey(apps.map((a) => a.slug))}`, title: fmt(t.compare.metaTitle, { names }), description: fmt(t.compare.metaDescription, { names }),
    // two listed products make a page worth indexing; three or four would multiply near-identical pages
    index: isIndexableComparison(apps.map((a) => a.slug)) && apps.every((a) => !a.isDemo),
  })
}

const DIMENSIONS: Dimension[] = ["company", "data", "ai", "technical", "product"]
const dash = <span className="text-muted-foreground" aria-hidden>–</span>

function Row({ label, apps, cell, hint }: { label: string; apps: CatalogApp[]; cell: (a: CatalogApp) => React.ReactNode; hint?: string }) {
  return (
    <tr className="border-b border-border/70 align-top">
      <th scope="row" className="sticky left-0 z-10 w-40 min-w-40 bg-background py-3 pr-4 text-left text-sm font-medium" title={hint}>{label}</th>
      {apps.map((a) => <td key={a.id} className="min-w-44 px-3 py-3 text-sm">{cell(a)}</td>)}
    </tr>
  )
}
function Heading({ title, span }: { title: string; span: number }) {
  return <tr><th scope="colgroup" colSpan={span} className="sticky left-0 bg-background pt-8 pb-2 text-left text-xs font-semibold tracking-widest text-muted-foreground uppercase">{title}</th></tr>
}
const list = (values: string[], max = 6) => (values.length ? `${values.slice(0, max).join(", ")}${values.length > max ? ` +${values.length - max}` : ""}` : null)

function FactCell({ app, attr, t, locale }: { app: CatalogApp; attr: FactAttribute; t: Dictionary["trust"]; locale: Locale }) {
  const f = app.facts[attr.key]
  const state = f?.state ?? "unknown"
  const origin = f?.origin ?? "none"
  return (
    <span className="flex flex-col items-start gap-1">
      <TrustSignal label={answerLabel(attr, state, f?.value ?? null, locale)} state={state} origin={origin} date={origin === "verified" ? f?.checkedAt : f?.statedAt} t={t} locale={locale} answerOnly />
      {state !== "unknown" && <span className="text-[11px] text-muted-foreground">{origin === "verified" ? t.sourceObserved : t.sourceVendor}</span>}
    </span>
  )
}

export default async function ComparisonPage({ params }: Props) {
  const [{ key }, { t, locale }, viewer, settings] = await Promise.all([params, getI18n(), getViewer(), getPublicSettings()])
  if (!settings.features.compare) notFound()
  const raw = decodeURIComponent(key)
  const apps = await resolve(raw)
  if (apps.length < 2) {
    // one app is not a comparison: continue on the start page, which keeps the selection
    if (apps.length === 1) permanentRedirect(localizeHref("/compare", locale))
    notFound()
  }
  const canonical = comparisonKey(apps.map((a) => a.slug))
  if (raw !== canonical) permanentRedirect(localizeHref(`/compare/${canonical}`, locale))

  const [registry, useCases, integrations] = await Promise.all([getFactRegistry(), getUseCases(), getIntegrationCatalog()])
  const slugs = apps.map((a) => a.slug)
  const span = apps.length + 1
  const factRows = (d: Dimension) => registry.filter((a) => a.dimension === d && a.key !== "company_country" && (a.isExpected || apps.some((app) => (app.facts[a.key]?.state ?? "unknown") !== "unknown")))
  const useCaseName = (s: string) => pick(useCases.find((u) => u.slug === s)?.name, locale, s)
  const integrationName = (s: string) => integrations.find((i) => i.slug === s)?.name ?? s

  return (
    <PageShell wide>
      <CompareSync items={apps.map((a) => ({ id: a.id, slug: a.slug, name: a.name, iconUrl: a.iconUrl }))} />
      <PageHeader title={apps.map((a) => a.name).join(` ${t.compare.vs} `)} body={t.compare.body} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <CompareToolbar slugs={slugs} signedIn={Boolean(viewer)} />
        <CompareAdd current={slugs} />
      </div>

      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full border-collapse">
          <caption className="sr-only">{fmt(t.compare.showing, { count: apps.length })}</caption>
          <thead>
            <tr className="align-bottom">
              <td className="sticky left-0 z-10 w-40 min-w-40 bg-background" />
              {apps.map((a) => (
                <th key={a.id} scope="col" className="min-w-44 px-3 pb-4 text-left font-normal">
                  <div className="relative rounded-2xl border border-border bg-card p-4">
                    <CompareRemove slug={a.slug} name={a.name} rest={slugs.filter((s) => s !== a.slug)} />
                    <AppIcon app={a} size="sm" />
                    <p className="mt-2 text-base font-semibold"><Link href={`/apps/${a.slug}`} className="hover:underline">{a.name}</Link></p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{(locale === "de" && a.taglineDe) || a.tagline}</p>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Heading title={t.compare.sections.general} span={span} />
            <Row label={t.compare.rows.category} apps={apps} cell={(a) => (a.category ? <Link href={`/categories/${a.category.slug}`} className="hover:underline">{pick(a.category.name, locale)}</Link> : dash)} />
            <Row label={t.compare.rows.pricing} apps={apps} cell={(a) => { const p = priceSummary(a); return p.model === "unknown" ? <span className="text-muted-foreground">{t.card.pricing.unknown}</span> : t.card.pricing[p.model] }} />
            <Row label={t.compare.rows.startingPrice} apps={apps} cell={(a) => (a.startingPriceCents !== null && a.priceCurrency ? formatPrice(locale, a.startingPriceCents, a.priceCurrency) : <span className="text-muted-foreground">{t.common.notStated}</span>)} />
            <Row label={t.compare.rows.freePlan} apps={apps} cell={(a) => (a.hasFreePlan === null ? <span className="text-muted-foreground">{t.common.notStated}</span> : a.hasFreePlan ? t.common.yes : t.common.no)} />
            <Row label={t.compare.rows.freeTrial} apps={apps} cell={(a) => (a.hasFreeTrial === null ? <span className="text-muted-foreground">{t.common.notStated}</span> : a.hasFreeTrial ? t.common.yes : t.common.no)} />
            <Row label={t.compare.rows.platforms} apps={apps} cell={(a) => list(a.platforms.map((p) => t.filters.platforms[p])) ?? dash} />
            <Row label={t.compare.rows.languages} apps={apps} cell={(a) => list(a.languages.map((l) => languageName(locale, l))) ?? <span className="text-muted-foreground">{t.common.notStated}</span>} />

            <Heading title={t.compare.sections.features} span={span} />
            <Row label={t.compare.rows.useCases} apps={apps} cell={(a) => list(a.useCases.map(useCaseName), 5) ?? <span className="text-muted-foreground">{t.common.notStated}</span>} />
            <Row label={t.compare.rows.integrations} apps={apps} cell={(a) => list(a.integrations.map(integrationName), 8) ?? <span className="text-muted-foreground">{t.common.notStated}</span>} />

            <Heading title={t.compare.sections.trust} span={span} />
            <Row label={t.compare.rows.verification} apps={apps} cell={(a) => <VerificationStatus state={a.verificationState} checkedAt={a.evidenceCheckedAt} t={t.trust} locale={locale} className="px-2 py-0.5 text-[11px]" />} />
            <Row label={t.compare.rows.evidence} hint={t.trust.evidenceCompletenessHelp} apps={apps} cell={(a) => fmt(t.trust.scoreLabel, { score: a.evidenceScore })} />
            <Row label={t.compare.rows.lastChecked} apps={apps} cell={(a) => (a.evidenceCheckedAt ? <time dateTime={a.evidenceCheckedAt}>{formatDate(locale, a.evidenceCheckedAt)}</time> : <span className="text-muted-foreground">{t.trust.notVerified}</span>)} />
            <Row label={t.compare.rows.ownership} apps={apps} cell={(a) => <OwnershipBadge status={a.ownershipStatus} t={t.card} showUnverified />} />
            <Row label={t.compare.rows.companyCountry} apps={apps} cell={(a) => (a.company?.countryCode ? countryName(locale, a.company.countryCode) : <span className="text-muted-foreground">{t.trust.notVerified}</span>)} />
            {DIMENSIONS.flatMap((d) => factRows(d)).map((attr) => (
              <Row key={attr.key} label={pick(attr.label, locale)} hint={pick(attr.description, locale)} apps={apps} cell={(a) => <FactCell app={a} attr={attr} t={t.trust} locale={locale} />} />
            ))}

            <Heading title={t.compare.sections.community} span={span} />
            <Row label={t.compare.rows.rating} apps={apps} cell={(a) => <RatingInline rating={a.rating} count={a.ratingsCount} locale={locale} t={t.card} />} />
            <Row label={t.compare.rows.reviews} apps={apps} cell={(a) => formatNumber(locale, a.reviewsCount)} />
            <Row label={t.compare.rows.saves} apps={apps} cell={(a) => formatNumber(locale, a.favoritesCount)} />
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">{t.trust.notACertificate} <Link href="/verification-methodology" className="font-medium text-brand hover:underline">{t.footer.links.methodology}</Link></p>
    </PageShell>
  )
}
