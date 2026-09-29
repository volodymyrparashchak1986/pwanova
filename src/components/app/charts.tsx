import type { Locale } from "@/i18n/config"
import { formatDate, formatNumber } from "@/i18n/format"

interface Point { date: string; views: number; opens: number; installActions: number }
export interface ChartLabels { views: string; outbound: string; installs: string; label: string; empty: string }

/** Server-rendered SVG trend chart (no client JavaScript). Every series has a text label in the legend. */
export function TrendChart({ data, labels, locale }: { data: Point[]; labels: ChartLabels; locale: Locale }) {
  const W = 640, H = 200, P = 8
  if (!data.length) return <p className="py-10 text-center text-sm text-muted-foreground">{labels.empty}</p>
  const max = Math.max(1, ...data.flatMap((d) => [d.views, d.opens, d.installActions]))
  const x = (i: number) => P + (i * (W - P * 2)) / Math.max(1, data.length - 1)
  const y = (v: number) => H - P - (v / max) * (H - P * 2)
  const line = (k: keyof Omit<Point, "date">) => data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(" ")
  const series = [["views", labels.views, "var(--chart-2)"], ["opens", labels.outbound, "var(--chart-1)"], ["installActions", labels.installs, "var(--chart-3)"]] as const
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-52 w-full" role="img" aria-label={labels.label}>
        {[0.25, 0.5, 0.75].map((t) => <line key={t} x1={P} x2={W - P} y1={H - P - t * (H - P * 2)} y2={H - P - t * (H - P * 2)} stroke="var(--border)" strokeDasharray="3 4" />)}
        {series.map(([k, , color]) => <path key={k} d={line(k)} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />)}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {series.map(([k, label, color]) => <span key={k} className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: color }} />{label}</span>)}
        <span className="ml-auto">{formatDate(locale, data[0].date)} – {formatDate(locale, data[data.length - 1].date)}</span>
      </figcaption>
    </figure>
  )
}

export function BarList({ items, names, locale, empty }: { items: { source: string; count: number }[]; names?: Record<string, string>; locale: Locale; empty: string }) {
  const total = items.reduce((s, i) => s + i.count, 0)
  if (!items.length) return <p className="py-6 text-sm text-muted-foreground">{empty}</p>
  const max = Math.max(...items.map((i) => i.count))
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.source}>
          <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate">{names?.[i.source] ?? i.source}</span><span className="shrink-0 tabular-nums text-muted-foreground">{formatNumber(locale, i.count)}{total ? ` · ${Math.round((i.count / total) * 100)} %` : ""}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand-gradient" style={{ width: `${(i.count / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  )
}
