import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/layout/providers"
import { PwaRegister } from "@/components/layout/pwa-register"
import { allowIndexing, siteUrl } from "@/lib/env"

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "PWANova — The distribution layer for the open web", template: "%s · PWANova" },
  description: "Discover, trust and install modern web apps. Ratings, reviews, verification and install guidance for the open web.",
  applicationName: "PWANova",
  robots: allowIndexing ? undefined : { index: false, follow: false },
  appleWebApp: { capable: true, title: "PWANova", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  openGraph: { type: "website", siteName: "PWANova", title: "PWANova — The distribution layer for the open web", description: "Discover. Trust. Install." },
  twitter: { card: "summary_large_image", title: "PWANova", description: "The distribution layer for the open web." },
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  )
}
