import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { EmptyState, PageHeader, PageShell } from "@/components/app/section-header"
import { AppCard } from "@/components/catalog/app-card"
import { Link } from "@/components/i18n/link"
import { buttonVariants } from "@/components/ui/button"
import { isLocale } from "@/i18n/config"
import { fmt } from "@/i18n/format"
import { getDictionary, getI18n } from "@/i18n/server"
import { getViewer } from "@/lib/data"
import { getSavedIds } from "@/lib/data/account"
import { getAlternativesTo, getCatalogBySlugs, getPublicSettings } from "@/lib/data/catalog"
import { pageMetadata } from "@/lib/seo"
import { comparisonKey } from "@/lib/v2/compare"
import { cn } from "@/lib/utils"

type Props = PageProps<"/[locale]/alternatives/[slug]">
const valid = (slug: string) => /^[a-z0-9-]{2,80}$/.test(slug)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale) || !valid(slug)) return {}
  const t = getDictionary(locale)
  const { name, apps } = await getAlternativesTo(slug)
  if (!apps.length) return { robots: { index: false, follow: true } }
  return pageMetadata({
    locale, path: `/alternatives/${slug}`, title: fmt(t.alternatives.title, { name }), description: fmt(t.alternatives.metaDescription, { name }),
    index: apps.length >= 2, // one listing is a product page, not a list of alternatives
  })
}

export default async function AlternativesPage({ params }: Props) {
  const [{ slug }, { t }, viewer, settings] = await Promise.all([params, getI18n(), getViewer(), getPublicSettings()])
  if (!valid(slug)) notFound()
  const [{ name, apps }, [listed], saved] = await Promise.all([getAlternativesTo(slug), getCatalogBySlugs([slug]), getSavedIds(viewer?.id ?? null)])
  // An address nobody refers to is not a page: no listing states this alternative and the product is not listed either.
  if (!apps.length && !listed) notFound()
  const title = listed?.name ?? name
  const european = apps.filter((a) => a.company?.inEu)
  const others = apps.filter((a) => !a.company?.inEu)
  const card = (a: (typeof apps)[number]) => <AppCard key={a.id} app={a} signedIn={Boolean(viewer)} saved={saved.has(a.id)} compareEnabled={settings.features.compare} />
  return (
    <PageShell>
      <PageHeader title={fmt(t.alternatives.title, { name: title })} body={fmt(t.alternatives.body, { name: title })}>
        <div className="mt-4 flex flex-wrap gap-2">
          {listed && <Link href={`/apps/${listed.slug}`} className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}>{fmt(t.alternatives.listed, { name: listed.name })}</Link>}
          {settings.features.compare && apps.length >= 2 && <Link href={`/compare/${comparisonKey(apps.slice(0, 4).map((a) => a.slug))}`} className={cn(buttonVariants(), "rounded-full")}>{t.alternatives.compareAll}</Link>}
        </div>
      </PageHeader>
      {!apps.length && <EmptyState title={fmt(t.alternatives.empty, { name: title })}><Link href="/discover" className={cn(buttonVariants(), "rounded-full")}>{t.errors.notFoundCta}</Link></EmptyState>}
      {european.length > 0 && (
        <section aria-labelledby="eu-h">
          <h2 id="eu-h" className="mb-4 text-2xl font-semibold tracking-tight">{t.alternatives.european}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{european.map(card)}</div>
        </section>
      )}
      {others.length > 0 && (
        <section className={european.length ? "mt-12" : undefined} aria-labelledby="others-h">
          {european.length > 0 && <h2 id="others-h" className="mb-4 text-2xl font-semibold tracking-tight">{t.alternatives.others}</h2>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{others.map(card)}</div>
        </section>
      )}
      <p className="mt-10 text-xs text-muted-foreground">{t.alternatives.disclaimer}</p>
    </PageShell>
  )
}
