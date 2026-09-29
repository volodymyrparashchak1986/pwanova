import type { Metadata } from "next"
import { PageHeader, PageShell } from "@/components/app/section-header"
import { Link } from "@/components/i18n/link"
import { SubmitForm } from "@/components/submit/submit-form"
import { buttonVariants } from "@/components/ui/button"
import { isLocale } from "@/i18n/config"
import { I18nScope } from "@/i18n/scope"
import { pick } from "@/i18n/format"
import { getDictionary, getI18n } from "@/i18n/server"
import { requireViewer } from "@/lib/auth"
import { getCategories, getFactRegistry, getUseCases } from "@/lib/data/catalog"
import { isSupabaseConfigured } from "@/lib/env"
import { pageMetadata } from "@/lib/seo"
import { countryChoices, languageChoices } from "@/lib/v2/choices"
import { STATEABLE_CAPABILITIES } from "@/lib/v2/options"
import { factLabel } from "@/lib/v2/trust"
import { cn } from "@/lib/utils"

export async function generateMetadata({ params }: PageProps<"/[locale]/submit">): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return pageMetadata({ locale, path: "/submit", title: t.submit.title, description: t.submit.metaDescription })
}

export default async function SubmitPage({ searchParams }: PageProps<"/[locale]/submit">) {
  const { t, locale } = await getI18n()
  if (!isSupabaseConfigured) {
    return (
      <PageShell className="max-w-2xl">
        <PageHeader title={t.submit.title} body={t.submit.body} />
        <p className="rounded-2xl border border-dashed border-border p-6 text-muted-foreground">{t.common.demoNoAccounts}</p>
        <Link href="/for-makers" className={cn(buttonVariants({ variant: "outline" }), "mt-6 rounded-full")}>{t.common.learnMore}</Link>
      </PageShell>
    )
  }
  await requireViewer("/submit")
  const [sp, categories, useCases, registry] = await Promise.all([searchParams, getCategories(), getUseCases(), getFactRegistry()])
  const initialUrl = typeof sp.url === "string" ? sp.url.slice(0, 2048) : undefined
  const partnerRef = typeof sp.ref === "string" && /^[a-z0-9_-]{2,40}$/i.test(sp.ref) ? sp.ref.toLowerCase() : undefined
  return (
    <PageShell className="max-w-3xl">
      <PageHeader title={t.submit.title} body={t.submit.body} />
      <I18nScope namespaces={["submit"]}>
      <SubmitForm
        initialUrl={initialUrl}
        partnerRef={partnerRef}
        countries={countryChoices(locale)}
        languages={languageChoices(locale)}
        categories={categories.map((c) => ({ value: c.slug, label: pick(c.name, locale) })).sort((a, b) => a.label.localeCompare(b.label, locale))}
        useCases={useCases.map((u) => ({ value: u.slug, label: pick(u.name, locale), category: u.categorySlug }))}
        capabilities={STATEABLE_CAPABILITIES.map((key) => ({ value: key, label: factLabel(registry.find((a) => a.key === key) ?? { key, label: { en: key }, positiveLabel: {}, negativeLabel: {} } as never, "yes", locale) }))}
        factLabels={Object.fromEntries(registry.map((a) => [a.key, pick(a.label, locale)]))}
      />
      </I18nScope>
    </PageShell>
  )
}
