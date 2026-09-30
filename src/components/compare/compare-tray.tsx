"use client"

import { usePathname } from "next/navigation"
import { X } from "lucide-react"
import { AppIcon } from "@/components/app/app-icon"
import { Link } from "@/components/i18n/link"
import { buttonVariants } from "@/components/ui/button"
import { compareStore, useCompare } from "./store"
import { useI18n } from "@/i18n/client"
import { splitLocale } from "@/i18n/config"
import { plural } from "@/i18n/format"
import { comparisonKey } from "@/lib/v2/compare"
import { cn } from "@/lib/utils"

/** The current selection, always within reach. Sits above the tab bar on phones. */
export function CompareTray() {
  const { t, locale } = useI18n()
  const items = useCompare()
  const { path } = splitLocale(usePathname())
  if (!items.length || path.startsWith("/compare")) return null
  const ready = items.length >= 2
  return (
    <aside aria-label={t.compare.trayLabel} className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-3 lg:bottom-5">
      <div className="glass pointer-events-auto flex max-w-full items-center gap-3 rounded-full border border-border py-1.5 pr-1.5 pl-3 shadow-soft">
        <ul className="flex -space-x-2">
          {items.map((i) => (
            <li key={i.slug} className="relative">
              <AppIcon app={i} size="sm" className="size-9! rounded-[10px]! text-sm! ring-2 ring-background" />
              <button type="button" onClick={() => compareStore.remove(i.slug)} aria-label={t.compare.remove.replace("{name}", i.name)}
                className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-foreground text-background">
                <X className="size-2.5" strokeWidth={3} />
              </button>
            </li>
          ))}
        </ul>
        <p className="hidden text-sm font-medium sm:block" aria-live="polite">{plural(locale, items.length, t.compare.tray)}</p>
        {ready
          ? <Link href={`/compare/${comparisonKey(items.map((i) => i.slug))}`} className={cn(buttonVariants({ size: "sm" }), "min-h-9 rounded-full px-4")}>{t.compare.open}</Link>
          : <span className="px-2 text-xs text-muted-foreground">{t.compare.needTwo}</span>}
        <button type="button" onClick={() => compareStore.clear()} aria-label={t.compare.clear} title={t.compare.clear} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
    </aside>
  )
}
