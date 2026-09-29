import type { Metadata } from "next"
import { PageHeader, PageShell } from "@/components/app/section-header"
import { Link } from "@/components/i18n/link"
import { isLocale } from "@/i18n/config"
import { plural } from "@/i18n/format"
import { getDictionary, getI18n } from "@/i18n/server"
import { getFacetCounts } from "@/lib/data/catalog"
import { pageMetadata } from "@/lib/seo"
import { COLLECTION_SLUGS, collectionCount } from "@/lib/v2/collections"

export async function generateMetadata({ params }: PageProps<"/[locale]/collections">): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return pageMetadata({ locale, path: "/collections", title: t.collections.title, description: t.collections.body })
}

export default async function CollectionsPage() {
  const [{ t, locale }, facets] = await Promise.all([getI18n(), getFacetCounts()])
  return (
    <PageShell>
      <PageHeader title={t.collections.title} body={t.collections.body} />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {COLLECTION_SLUGS.map((slug) => (
          <li key={slug}>
            <Link href={`/collections/${slug}`} className="flex h-full flex-col rounded-3xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand/30">
              <span className="text-lg leading-tight font-semibold">{t.collections.items[slug].title}</span>
              <span className="mt-1 text-sm text-muted-foreground">{t.collections.items[slug].body}</span>
              <span className="mt-auto pt-3 text-xs font-medium text-muted-foreground">{plural(locale, collectionCount(slug, facets), t.categories.count)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  )
}
