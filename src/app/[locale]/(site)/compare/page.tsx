import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { PageHeader, PageShell } from "@/components/app/section-header"
import { CompareStart } from "@/components/compare/compare-controls"
import { SavedComparisons } from "@/components/compare/saved-comparisons"
import { isLocale, localizeHref } from "@/i18n/config"
import { getDictionary, getI18n } from "@/i18n/server"
import { getViewer } from "@/lib/data"
import { getSavedComparisons } from "@/lib/data/account"
import { getPublicSettings } from "@/lib/data/catalog"
import { pageMetadata } from "@/lib/seo"
import { comparisonKey, comparisonSlugs } from "@/lib/v2/compare"

export async function generateMetadata({ params }: PageProps<"/[locale]/compare">): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return pageMetadata({ locale, path: "/compare", title: t.compare.title, description: t.compare.metaIndexDescription })
}

export default async function ComparePage({ searchParams }: PageProps<"/[locale]/compare">) {
  const [sp, { t, locale }, viewer, settings] = await Promise.all([searchParams, getI18n(), getViewer(), getPublicSettings()])
  if (!settings.features.compare) notFound()
  // ?apps=a,b is accepted as an address somebody typed or an old link; the canonical form is /compare/a-vs-b
  const listed = comparisonSlugs((Array.isArray(sp.apps) ? sp.apps.join(",") : sp.apps ?? "").split(","))
  if (listed.length >= 2) permanentRedirect(localizeHref(`/compare/${comparisonKey(listed)}`, locale))
  const saved = viewer ? await getSavedComparisons(viewer.id) : []
  return (
    <PageShell>
      <PageHeader title={t.compare.title} body={t.compare.body} />
      <CompareStart />
      <SavedComparisons items={saved} />
    </PageShell>
  )
}
