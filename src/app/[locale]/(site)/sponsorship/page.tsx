import type { Metadata } from "next"
import { ContentPage } from "@/components/layout/content-page"
import { SponsorshipContent } from "@/content/sponsorship"
import { isLocale } from "@/i18n/config"
import { getDictionary, getI18n } from "@/i18n/server"
import { getPublicSettings } from "@/lib/data/catalog"
import { pageMetadata } from "@/lib/seo"

export async function generateMetadata({ params }: PageProps<"/[locale]/sponsorship">): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return pageMetadata({ locale, path: "/sponsorship", title: t.sponsorship.title, description: t.card.sponsoredHelp })
}

export default async function SponsorshipPage() {
  const [{ t, locale }, settings] = await Promise.all([getI18n(), getPublicSettings()])
  return <ContentPage title={t.sponsorship.title}><SponsorshipContent locale={locale} active={settings.features.sponsorship} /></ContentPage>
}
