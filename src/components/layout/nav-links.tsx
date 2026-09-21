"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/explore", label: "Discover" },
  { href: "/top", label: "Top Apps" },
  { href: "/trending", label: "Trending" },
  { href: "/new", label: "New" },
  { href: "/categories", label: "Categories" },
  { href: "/for-developers", label: "For Developers" },
]

export function NavLinks() {
  const path = usePathname()
  return (
    <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            "whitespace-nowrap rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            path.startsWith(l.href) && "bg-muted font-medium text-foreground",
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  )
}
