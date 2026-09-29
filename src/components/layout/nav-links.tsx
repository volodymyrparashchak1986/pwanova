"use client"

import { usePathname } from "next/navigation"
import { Link } from "@/components/i18n/link"
import { useI18n } from "@/i18n/client"
import { splitLocale } from "@/i18n/config"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/discover", key: "discover" },
  { href: "/categories", key: "categories" },
  { href: "/compare", key: "compare" },
  { href: "/launches", key: "launches" },
  { href: "/requests", key: "requests" },
  { href: "/for-makers", key: "forMakers" },
] as const

export function NavLinks({ hidden = [] }: { hidden?: string[] }) {
  const { t } = useI18n()
  const { path } = splitLocale(usePathname())
  return (
    <nav className="hidden items-center gap-0.5 lg:flex" aria-label={t.nav.main}>
      {LINKS.filter((l) => !hidden.includes(l.key)).map((l) => (
        <Link
          key={l.href} href={l.href} aria-current={path.startsWith(l.href) ? "page" : undefined}
          className={cn(
            "whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            path.startsWith(l.href) && "bg-muted font-medium text-foreground",
          )}
        >
          {t.nav[l.key]}
        </Link>
      ))}
    </nav>
  )
}
