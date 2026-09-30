import type { Metadata } from "next"
import { ContentPage } from "@/components/layout/content-page"
import { ImprintContent, LEGAL_UPDATED, operatorComplete } from "@/content/legal"
import { isLocale } from "@/i18n/config"
import { fmt, formatDate } from "@/i18n/format"
import { getDictionary, getI18n } from "@/i18n/server"
import { getPublicSettings } from "@/lib/data/catalog"
import { pageMetadata } from "@/lib/seo"

export async function generateMetadata({ params }: PageProps<"/[locale]/legal/imprint">): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  // a template without the operator's details is not a page to offer to search engines
  const { operator } = await getPublicSettings()
  return pageMetadata({ locale, path: "/legal/imprint", title: t.legal.imprintTitle, index: operatorComplete(operator) })
}

export default async function LegalPage() {
  const [{ t, locale }, settings] = await Promise.all([getI18n(), getPublicSettings()])
  const notice = [t.legal.draftNotice, !operatorComplete(settings.operator) && t.legal.missingOperator].filter(Boolean).join(" ")
  return (
    <ContentPage title={t.legal.imprintTitle} notice={notice} updated={fmt(t.legal.lastUpdated, { date: formatDate(locale, LEGAL_UPDATED, "long") })}>
      <ImprintContent locale={locale} operator={settings.operator} />
    </ContentPage>
  )
}
