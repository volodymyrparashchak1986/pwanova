import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"
import { PageHeader, PageShell } from "@/components/app/section-header"
import { CatalogView } from "@/components/catalog/catalog-view"
import { isLocale, localizeHref } from "@/i18n/config"
import { fmt } from "@/i18n/format"
import { getDictionary, getI18n } from "@/i18n/server"
import { pageMetadata } from "@/lib/seo"
import { catalogHref, isIndexableCatalog, parseCatalogParams, type SearchParams } from "@/lib/v2/params"

const LEGACY_PARAMS = ["verified", "pwa", "installable", "build", "launch"]

export async function generateMetadata({ params, searchParams }: PageProps<"/[locale]/discover">): Promise<Metadata> {
  const [{ locale }, sp] = await Promise.all([params, searchParams])
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  const state = parseCatalogParams(sp as SearchParams)
  return pageMetadata({
    locale, path: "/discover", title: state.q ? fmt(t.discover.titleQuery, { query: state.q }) : t.discover.title,
    description: t.discover.metaDescription, index: isIndexableCatalog(state),
  })
}

export default async function DiscoverPage({ searchParams }: PageProps<"/[locale]/discover">) {
  const sp = (await searchParams) as SearchParams
  const { t, locale } = await getI18n()
  const state = parseCatalogParams(sp)
  // v1 links (?verified=1, ?pwa=1, ?sort=top …) are sent once to the equivalent V2 address
  if (LEGACY_PARAMS.some((p) => p in sp) || sp.sort === "top") permanentRedirect(localizeHref(catalogHref(state), locale))
  return (
    <PageShell wide>
      <PageHeader title={state.q ? fmt(t.discover.titleQuery, { query: state.q }) : t.discover.title} body={t.discover.body} />
      <CatalogView state={state} base="/discover" autoFocus={sp.focus === "1"} sponsorPlacement={{ placement: "discover" }} />
    </PageShell>
  )
}
