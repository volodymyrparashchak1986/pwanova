"use client"

import { usePathname } from "next/navigation"
import { Bookmark, Compass, GitCompareArrows, Home, User } from "lucide-react"
import { Link } from "@/components/i18n/link"
import { useI18n } from "@/i18n/client"
import { splitLocale } from "@/i18n/config"
import { cn } from "@/lib/utils"

const ITEMS = [
  { href: "/", key: "home", icon: Home },
  { href: "/discover", key: "discover", icon: Compass },
  { href: "/compare", key: "compare", icon: GitCompareArrows },
  { href: "/saved", key: "saved", icon: Bookmark },
  { href: "/profile", key: "profile", icon: User },
] as const

/** Tab bar for phones and tablets. Respects the home-indicator safe area. */
export function MobileNav() {
  const { t } = useI18n()
  const { path } = splitLocale(usePathname())
  return (
    <nav aria-label={t.nav.primary} className="glass pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border lg:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {ITEMS.map(({ href, key, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href)
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium transition-colors", active ? "text-brand" : "text-muted-foreground")}>
                <Icon className={cn("size-[22px] transition-transform", active && "scale-110")} strokeWidth={active ? 2.4 : 1.9} />
                {t.nav[key]}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
