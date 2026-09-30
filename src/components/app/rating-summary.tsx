import { Stars } from "./stars"
import type { Locale } from "@/i18n/config"
import type { Dictionary } from "@/i18n/dictionaries"
import { fmt, plural } from "@/i18n/format"
import type { RatingBreakdown } from "@/lib/types"

export function RatingSummary({ data, t, locale }: { data: RatingBreakdown; t: Dictionary; locale: Locale }) {
  const average = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(data.average)
  return (
    <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
      <div className="text-center sm:text-left">
        <p className="text-6xl font-semibold tracking-tight tabular-nums">{data.count ? average : "–"}</p>
        {data.count > 0 && <Stars value={data.average} size={18} className="mt-2" label={fmt(t.common.starsOf, { value: average })} />}
        <p className="mt-1.5 text-sm text-muted-foreground">{data.count ? plural(locale, data.count, t.card.ratings) : t.card.noRatings}</p>
      </div>
      {data.count > 0 && (
        <ul className="space-y-1.5" aria-label={t.reviews.breakdown}>
          {data.rows.map((r) => (
            <li key={r.stars} className="flex items-center gap-3 text-sm">
              <span className="w-9 shrink-0 tabular-nums text-muted-foreground">{r.stars} ★</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-star" style={{ width: `${r.percent}%` }} /></span>
              <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">{r.percent}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
