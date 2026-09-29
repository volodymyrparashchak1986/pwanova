import type { Locale } from "@/i18n/config"
import type { Dictionary } from "@/i18n/dictionaries"
import { fmt, formatPrice } from "@/i18n/format"
import { priceSummary } from "@/lib/v2/trust"
import type { CatalogApp } from "@/lib/v2/types"
import { cn } from "@/lib/utils"

/** Pricing model and, when the vendor states one, the starting price. Unknown pricing is said, not hidden. */
export function PriceBadge({ app, t, locale, className }: { app: Pick<CatalogApp, "pricingModel" | "hasFreePlan" | "startingPriceCents" | "priceCurrency">; t: Dictionary["card"]; locale: Locale; className?: string }) {
  const { model, from } = priceSummary(app)
  const known = model !== "unknown"
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", known ? "text-foreground/80" : "text-muted-foreground", className)}>
      {t.pricing[model]}
      {from && from.cents > 0 && <span className="text-muted-foreground">· {fmt(t.from, { price: formatPrice(locale, from.cents, from.currency) })}</span>}
    </span>
  )
}
