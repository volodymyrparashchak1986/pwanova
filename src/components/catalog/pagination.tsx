import { ChevronLeft, ChevronRight } from "lucide-react"
import { Link } from "@/components/i18n/link"
import { buttonVariants } from "@/components/ui/button"
import type { Dictionary } from "@/i18n/dictionaries"
import { fmt } from "@/i18n/format"
import { cn } from "@/lib/utils"

export function Pagination({ page, pages, hrefFor, t }: { page: number; pages: number; hrefFor: (page: number) => string; t: Dictionary }) {
  if (pages <= 1) return null
  const item = cn(buttonVariants({ variant: "outline" }), "rounded-full")
  return (
    <nav aria-label={t.common.pagination} className="mt-10 flex items-center justify-center gap-3">
      {page > 1
        ? <Link href={hrefFor(page - 1)} rel="prev" className={item}><ChevronLeft className="size-4" aria-hidden />{t.common.previous}</Link>
        : <span className={cn(item, "pointer-events-none opacity-40")} aria-disabled><ChevronLeft className="size-4" aria-hidden />{t.common.previous}</span>}
      <span className="text-sm tabular-nums text-muted-foreground">{fmt(t.discover.pageOf, { page, pages })}</span>
      {page < pages
        ? <Link href={hrefFor(page + 1)} rel="next" className={item}>{t.common.next}<ChevronRight className="size-4" aria-hidden /></Link>
        : <span className={cn(item, "pointer-events-none opacity-40")} aria-disabled>{t.common.next}<ChevronRight className="size-4" aria-hidden /></span>}
    </nav>
  )
}
