import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PageHeader, PageShell } from "@/components/app/section-header"
import { SignedOutCard } from "@/components/app/signed-out"
import { RequestForm } from "@/components/requests/request-form"
import { isLocale } from "@/i18n/config"
import { I18nScope } from "@/i18n/scope"
import { pick } from "@/i18n/format"
import { getDictionary, getI18n } from "@/i18n/server"
import { getViewer } from "@/lib/data"
import { getFacetCounts, getPublicSettings } from "@/lib/data/catalog"
import { getLookups } from "@/lib/data/lookups"
import { pageMetadata } from "@/lib/seo"
import { countryChoices, languageChoices } from "@/lib/v2/choices"
import { REQUESTABLE_FACTS } from "@/lib/v2/options"
import { factLabel } from "@/lib/v2/trust"

export async function generateMetadata({ params }: PageProps<"/[locale]/requests/new">): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return pageMetadata({ locale, path: "/requests/new", title: t.requests.newTitle, description: t.requests.metaDescription })
}

export default async function NewRequestPage() {
  const [{ t, locale }, viewer, settings] = await Promise.all([getI18n(), getViewer(), getPublicSettings()])
  if (!settings.features.requests) notFound()
  if (!viewer) return <PageShell><SignedOutCard title={t.requests.signInTitle} body={t.requests.signInBody} next="/requests/new" /></PageShell>
  const [lookups, facets] = await Promise.all([getLookups(), getFacetCounts()])
  return (
    <PageShell className="max-w-3xl">
      <PageHeader title={t.requests.newTitle} body={t.requests.newBody} />
      <I18nScope namespaces={["requests"]}>
      <RequestForm
        countries={countryChoices(locale)}
        languages={languageChoices(locale, 12)}
        defaults={{ name: viewer.displayName === "You" ? "" : viewer.displayName, email: viewer.email ?? "" }}
        categories={lookups.categories.map((c) => ({ value: c.slug, label: pick(c.name, locale) })).sort((a, b) => a.label.localeCompare(b.label, locale))}
        useCases={lookups.useCases.map((u) => ({ value: u.slug, label: pick(u.name, locale), category: (u as { categorySlug?: string | null }).categorySlug ?? null }))}
        facts={REQUESTABLE_FACTS.flatMap((key) => { const a = lookups.registry.find((x) => x.key === key); return a ? [{ value: key, label: factLabel(a, "yes", locale) }] : [] })}
        // only integrations that at least one listing documents can be matched
        integrations={lookups.integrations.filter((i) => (facets.integrations[i.slug] ?? 0) > 0).map((i) => ({ value: i.slug, label: i.name }))}
      />
      </I18nScope>
    </PageShell>
  )
}
