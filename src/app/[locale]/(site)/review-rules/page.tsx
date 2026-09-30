import type { Metadata } from "next"
import { ContentPage } from "@/components/layout/content-page"
import { ReviewRulesContent } from "@/content/review-rules"
import { isLocale } from "@/i18n/config"
import { getDictionary, getI18n } from "@/i18n/server"
import { pageMetadata } from "@/lib/seo"

export async function generateMetadata({ params }: PageProps<"/[locale]/review-rules">): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return pageMetadata({ locale, path: "/review-rules", title: t.reviews.rules, description: t.reviews.registeredUserHelp })
}

export default async function ReviewRulesPage() {
  const { t, locale } = await getI18n()
  return <ContentPage title={t.reviews.rules}><ReviewRulesContent locale={locale} /></ContentPage>
}
