"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, Bookmark, Compass, Home, User } from "lucide-react"
import { cn } from "@/lib/utils"

const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/activity", label: "Activity", icon: Bell },
  { href: "/profile", label: "Profile", icon: User },
]

/** iOS/Android-style tab bar. Respects the home-indicator safe area. */
export function MobileNav() {
  const path = usePathname()
  if (path.startsWith("/embed")) return null
  return (
    <nav aria-label="Primary" className="glass pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border lg:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href)
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium transition-colors", active ? "text-brand" : "text-muted-foreground")}>
                <Icon className={cn("size-[22px] transition-transform", active && "scale-110")} strokeWidth={active ? 2.4 : 1.9} />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
