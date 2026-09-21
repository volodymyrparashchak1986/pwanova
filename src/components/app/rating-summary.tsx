import { Stars } from "./stars"
import type { RatingBreakdown } from "@/lib/types"

export function RatingSummary({ data }: { data: RatingBreakdown }) {
  return (
    <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
      <div className="text-center sm:text-left">
        <p className="text-6xl font-semibold tracking-tight tabular-nums">{data.count ? data.average.toFixed(1) : "–"}</p>
        <Stars value={data.average} size={18} className="mt-2" />
        <p className="mt-1.5 text-sm text-muted-foreground">{new Intl.NumberFormat("en").format(data.count)} {data.count === 1 ? "rating" : "ratings"}</p>
      </div>
      <ul className="space-y-1.5" aria-label="Rating breakdown">
        {data.rows.map((r) => (
          <li key={r.stars} className="flex items-center gap-3 text-sm">
            <span className="w-9 shrink-0 tabular-nums text-muted-foreground">{r.stars} ★</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-star" style={{ width: `${r.percent}%` }} /></span>
            <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">{r.percent}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
