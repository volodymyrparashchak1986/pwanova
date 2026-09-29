import type { Metadata } from "next"
import { PageHeader, PageShell } from "@/components/app/section-header"
import { CategoryIcon } from "@/components/catalog/category-icon"
import { Link } from "@/components/i18n/link"
import { isLocale } from "@/i18n/config"
import { pick, plural } from "@/i18n/format"
import { getDictionary, getI18n } from "@/i18n/server"
import { getCategories } from "@/lib/data/catalog"
import { pageMetadata } from "@/lib/seo"

export async function generateMetadata({ params }: PageProps<"/[locale]/categories">): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return pageMetadata({ locale, path: "/categories", title: t.categories.title, description: t.categories.metaDescription })
}

export default async function CategoriesPage() {
  const [{ t, locale }, categories] = await Promise.all([getI18n(), getCategories()])
  return (
    <PageShell>
      <PageHeader title={t.categories.title} body={t.categories.body} />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <li key={c.slug}>
            <Link href={`/categories/${c.slug}`} className="flex h-full items-start gap-4 rounded-3xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand/30">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand"><CategoryIcon name={c.icon} className="size-5" /></span>
              <span className="min-w-0">
                <span className="block text-lg leading-tight font-semibold">{pick(c.name, locale)}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{pick(c.description, locale)}</span>
                <span className="mt-3 block text-xs font-medium text-muted-foreground">{plural(locale, c.count, t.categories.count)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  )
}
