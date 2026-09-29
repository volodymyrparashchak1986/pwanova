import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "../globals.css"
import { Providers } from "@/components/layout/providers"
import { siteUrl } from "@/lib/env"

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

/** Root layout for routes that exist once, without a language prefix: embeds and the offline page. */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "PWANova", template: "%s · PWANova" },
  robots: { index: false, follow: false },
}
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" }

export default function PlainLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col"><Providers>{children}</Providers></body>
    </html>
  )
}
