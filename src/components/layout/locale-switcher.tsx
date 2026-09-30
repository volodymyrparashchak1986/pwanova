"use client"

import NextLink from "next/link"
import { usePathname } from "next/navigation"
import { LOCALE_COOKIE, LOCALE_NAMES, LOCALES, switchLocale } from "@/i18n/config"
import { useI18n } from "@/i18n/client"
import { cn } from "@/lib/utils"

/** Links to the same page in the other language. Plain links, so it works without JavaScript and for crawlers. */
export function LocaleSwitcher({ className, full = false }: { className?: string; full?: boolean }) {
  const { locale, t } = useI18n()
  const pathname = usePathname()
  return (
    <div className={cn("inline-flex items-center rounded-full border border-border p-0.5 text-xs font-medium", className)} role="group" aria-label={t.common.language}>
      {LOCALES.map((l) => (
        <NextLink
          key={l} href={switchLocale(pathname, l)} hrefLang={l} lang={l} aria-current={l === locale ? "true" : undefined}
          onClick={(e) => {
            // Picking a language is the one moment the choice is remembered (functional cookie, one year).
            document.cookie = `${LOCALE_COOKIE}=${l}; Max-Age=31536000; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`
            // keep filters and search when switching language
            if (typeof window !== "undefined" && window.location.search) {
              e.preventDefault()
              window.location.assign(switchLocale(pathname, l) + window.location.search + window.location.hash)
            }
          }}
          className={cn("rounded-full px-2 py-1 transition-colors", l === locale ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
        >
          {full ? LOCALE_NAMES[l] : l.toUpperCase()}
        </NextLink>
      ))}
    </div>
  )
}
