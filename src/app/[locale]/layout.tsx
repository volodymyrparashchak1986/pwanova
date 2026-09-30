import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { notFound } from "next/navigation"
import "../globals.css"
import { Providers } from "@/components/layout/providers"
import { PwaRegister } from "@/components/layout/pwa-register"
import { I18nProvider } from "@/i18n/client"
import { isLocale, languageAlternates, LOCALES, OG_LOCALES } from "@/i18n/config"
import { clientDictionary, getDictionary } from "@/i18n/server"
import { allowIndexing, siteUrl } from "@/lib/env"

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  const title = `${t.common.siteName} — ${t.common.tagline}`
  return {
    metadataBase: new URL(siteUrl),
    title: { default: title, template: `%s · ${t.common.siteName}` },
    description: t.footer.about,
    applicationName: t.common.siteName,
    robots: allowIndexing ? undefined : { index: false, follow: false },
    appleWebApp: { capable: true, title: t.common.siteName, statusBarStyle: "black-translucent" },
    formatDetection: { telephone: false },
    alternates: { canonical: `${siteUrl}/${locale}`, ...languageAlternates("/", siteUrl) },
    openGraph: {
      type: "website", siteName: t.common.siteName, title, description: t.footer.about, locale: OG_LOCALES[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALES[l]),
    },
    twitter: { card: "summary_large_image", title: t.common.siteName, description: t.common.tagline },
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f8fc" },
    { media: "(prefers-color-scheme: dark)", color: "#14141c" },
  ],
}

export default async function RootLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  return (
    <html lang={locale} data-scroll-behavior="smooth" suppressHydrationWarning className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale} dictionary={clientDictionary(locale)}>
          <Providers>{children}</Providers>
        </I18nProvider>
        <PwaRegister />
      </body>
    </html>
  )
}
