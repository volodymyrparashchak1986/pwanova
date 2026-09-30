import { Star } from "lucide-react"
import type { Locale } from "@/i18n/config"
import type { Dictionary } from "@/i18n/dictionaries"
import { fmt, plural } from "@/i18n/format"
import { cn } from "@/lib/utils"

export function Stars({ value, size = 14, label, className }: { value: number; size?: number; label?: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100))
  const row = (cls: string) => (
    <span className={cn("flex", cls)}>{[0, 1, 2, 3, 4].map((i) => <Star key={i} width={size} height={size} className="shrink-0 fill-current" strokeWidth={1.5} />)}</span>
  )
  return (
    <span className={cn("relative inline-flex", className)} role="img" aria-label={label ?? `${value.toFixed(1)} / 5`}>
      {row("text-muted-foreground/30")}
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>{row("text-star")}</span>
    </span>
  )
}

/** Average and number of ratings. Without ratings it says so; it never shows an empty five-star row. */
export function RatingInline({ rating, count, locale, t, className }: { rating: number; count: number; locale: Locale; t: Dictionary["card"]; className?: string }) {
  if (!count) return <span className={cn("text-xs text-muted-foreground", className)}>{t.noRatings}</span>
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <span className="font-semibold text-foreground">{new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rating)}</span>
      <Star className="size-3 fill-star text-star" aria-hidden />
      <span>· {plural(locale, count, t.ratings)}</span>
    </span>
  )
}

export const starsLabel = (template: string, value: number, locale: Locale) =>
  fmt(template, { value: new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value) })
