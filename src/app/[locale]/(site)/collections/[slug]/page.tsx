import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PageHeader, PageShell } from "@/components/app/section-header"
import { CatalogView } from "@/components/catalog/catalog-view"
import { Link } from "@/components/i18n/link"
import { isLocale } from "@/i18n/config"
import { getDictionary, getI18n } from "@/i18n/server"
import { getFacetCounts } from "@/lib/data/catalog"
import { pageMetadata } from "@/lib/seo"
import { collectionCount, COLLECTIONS, isCollection, MIN_INDEXABLE_LISTINGS } from "@/lib/v2/collections"
import { isIndexableCatalog, parseCatalogParams, type SearchParams } from "@/lib/v2/params"

type Props = PageProps<"/[locale]/collections/[slug]">

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ locale, slug }, sp] = await Promise.all([params, searchParams])
  if (!isLocale(locale) || !isCollection(slug)) return {}
  const t = getDictionary(locale)
  const facets = await getFacetCounts()
  return pageMetadata({
    locale, path: `/collections/${slug}`, title: t.collections.items[slug].title, description: t.collections.items[slug].body,
    index: isIndexableCatalog(parseCatalogParams(sp as SearchParams)) && collectionCount(slug, facets) >= MIN_INDEXABLE_LISTINGS,
  })
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ slug }, sp, { t }] = await Promise.all([params, searchParams, getI18n()])
  if (!isCollection(slug)) notFound()
  const state = parseCatalogParams(sp as SearchParams)
  const fixed = COLLECTIONS[slug].filters
  // the collection's own fact is part of the page, not a removable filter
  const own = "facts" in fixed ? fixed.facts : []
  const visible = { ...state, filters: { ...state.filters, facts: (state.filters.facts ?? []).filter((f) => !own.includes(f as never)) } }
  const merged = "facts" in fixed ? { facts: [...new Set([...own, ...(visible.filters.facts ?? [])])] } : { euCompany: true }
  return (
    <PageShell wide>
      <nav aria-label={t.common.breadcrumb} className="mb-3 text-sm text-muted-foreground"><Link href="/collections" className="hover:text-foreground">{t.collections.title}</Link> / <span aria-current="page">{t.collections.items[slug].title}</span></nav>
      <PageHeader title={t.collections.items[slug].title} body={t.collections.items[slug].body} />
      <CatalogView state={visible} base={`/collections/${slug}`} fixed={merged} />
    </PageShell>
  )
}
