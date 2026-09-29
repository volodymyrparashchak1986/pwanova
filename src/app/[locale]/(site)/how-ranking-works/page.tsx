import type { Metadata } from "next"
import { ContentPage } from "@/components/layout/content-page"
import { RankingContent } from "@/content/ranking"
import { isLocale } from "@/i18n/config"
import { getDictionary, getI18n } from "@/i18n/server"
import { pageMetadata } from "@/lib/seo"

export async function generateMetadata({ params }: PageProps<"/[locale]/how-ranking-works">): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return pageMetadata({ locale, path: "/how-ranking-works", title: t.ranking.title, description: t.discover.organicNote })
}

export default async function RankingPage() {
  const { t, locale } = await getI18n()
  return <ContentPage title={t.ranking.title}><RankingContent locale={locale} /></ContentPage>
}
