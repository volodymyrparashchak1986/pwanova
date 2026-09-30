import type { Metadata } from "next"
import { ContentPage } from "@/components/layout/content-page"
import { MethodologyContent } from "@/content/methodology"
import { isLocale } from "@/i18n/config"
import { getDictionary, getI18n } from "@/i18n/server"
import { pageMetadata } from "@/lib/seo"

export async function generateMetadata({ params }: PageProps<"/[locale]/verification-methodology">): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return pageMetadata({ locale, path: "/verification-methodology", title: t.methodology.title, description: t.trust.notACertificate })
}

export default async function MethodologyPage() {
  const { t, locale } = await getI18n()
  return <ContentPage title={t.methodology.title}><MethodologyContent locale={locale} /></ContentPage>
}
