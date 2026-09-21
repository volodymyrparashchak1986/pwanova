import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100))
  const row = (cls: string) => (
    <span className={cn("flex", cls)}>{[0, 1, 2, 3, 4].map((i) => <Star key={i} width={size} height={size} className="shrink-0 fill-current" strokeWidth={1.5} />)}</span>
  )
  return (
    <span className={cn("relative inline-flex", className)} role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {row("text-muted-foreground/30")}
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>{row("text-star")}</span>
    </span>
  )
}

export function RatingInline({ rating, count, className }: { rating: number; count: number; className?: string }) {
  if (!count) return <span className={cn("text-xs text-muted-foreground", className)}>No ratings yet</span>
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <span className="font-semibold text-foreground">{rating.toFixed(1)}</span>
      <Star className="size-3 fill-star text-star" />
      <span>· {new Intl.NumberFormat("en").format(count)} {count === 1 ? "rating" : "ratings"}</span>
    </span>
  )
}
