import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PageHeader, PageShell } from "@/components/app/section-header"
import { CatalogView } from "@/components/catalog/catalog-view"
import { FollowCategoryButton } from "@/components/catalog/follow-category"
import { Link } from "@/components/i18n/link"
import { isLocale } from "@/i18n/config"
import { fmt, pick } from "@/i18n/format"
import { getDictionary, getI18n } from "@/i18n/server"
import { getViewer } from "@/lib/data"
import { isFollowingCategory } from "@/lib/data/account"
import { getCategories, getUseCases } from "@/lib/data/catalog"
import { siteUrl } from "@/lib/env"
import { jsonLd } from "@/lib/security/sanitize"
import { pageMetadata } from "@/lib/seo"
import { isIndexableCatalog, parseCatalogParams, type SearchParams } from "@/lib/v2/params"

type Props = PageProps<"/[locale]/categories/[slug]">

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ locale, slug }, sp] = await Promise.all([params, searchParams])
  if (!isLocale(locale)) return {}
  const category = (await getCategories()).find((c) => c.slug === slug)
  if (!category) return {}
  const t = getDictionary(locale)
  const name = pick(category.name, locale)
  const state = parseCatalogParams(sp as SearchParams)
  return pageMetadata({
    locale, path: `/categories/${slug}`, title: name, description: pick(category.description, locale) || fmt(t.categories.categoryMeta, { name }),
    // an empty category is a page without content: it stays out of the index until it has listings
    index: isIndexableCatalog(state) && category.count > 0,
  })
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp, { t, locale }, viewer] = await Promise.all([params, searchParams, getI18n(), getViewer()])
  const [categories, useCases] = await Promise.all([getCategories(), getUseCases()])
  const category = categories.find((c) => c.slug === slug)
  if (!category) notFound()
  const state = parseCatalogParams(sp as SearchParams)
  const name = pick(category.name, locale)
  const related = useCases.filter((u) => u.categorySlug === slug)
  const following = await isFollowingCategory(category.id, viewer?.id ?? null)
  const breadcrumbs = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t.categories.title, item: `${siteUrl}/${locale}/categories` },
      { "@type": "ListItem", position: 2, name, item: `${siteUrl}/${locale}/categories/${slug}` },
    ],
  }
  return (
    <PageShell wide>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} />
      <nav aria-label={t.common.breadcrumb} className="mb-3 text-sm text-muted-foreground"><Link href="/categories" className="hover:text-foreground">{t.categories.title}</Link> / <span aria-current="page">{name}</span></nav>
      <PageHeader title={name} body={pick(category.description, locale)}>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <FollowCategoryButton categoryId={category.id} slug={slug} active={following} signedIn={Boolean(viewer)} />
          {related.map((u) => <Link key={u.slug} href={`/categories/${slug}?use=${u.slug}`} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground">{pick(u.name, locale)}</Link>)}
        </div>
      </PageHeader>
      <CatalogView state={state} base={`/categories/${slug}`} fixed={{ categories: [slug] }} sponsorPlacement={{ placement: "category", categoryId: category.id }} />
    </PageShell>
  )
}
