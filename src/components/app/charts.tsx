import { TRAFFIC_SOURCE_LABELS } from "@/lib/constants"
import { formatCount } from "@/lib/format"

interface Point { date: string; views: number; opens: number; installActions: number }

/** Server-rendered SVG trend chart (no client JS). */
export function TrendChart({ data }: { data: Point[] }) {
  const W = 640, H = 200, P = 8
  if (!data.length) return <p className="py-10 text-center text-sm text-muted-foreground">No activity yet.</p>
  const max = Math.max(1, ...data.flatMap((d) => [d.views, d.opens, d.installActions]))
  const x = (i: number) => P + (i * (W - P * 2)) / Math.max(1, data.length - 1)
  const y = (v: number) => H - P - (v / max) * (H - P * 2)
  const line = (k: keyof Omit<Point, "date">) => data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(" ")
  const series = [["views", "Views", "var(--chart-2)"], ["opens", "Opens", "var(--chart-1)"], ["installActions", "Install actions", "var(--chart-3)"]] as const
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-52 w-full" role="img" aria-label="Views, opens and install actions over time">
        {[0.25, 0.5, 0.75].map((t) => <line key={t} x1={P} x2={W - P} y1={H - P - t * (H - P * 2)} y2={H - P - t * (H - P * 2)} stroke="var(--border)" strokeDasharray="3 4" />)}
        {series.map(([k, , color]) => <path key={k} d={line(k)} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />)}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {series.map(([k, label, color]) => <span key={k} className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: color }} />{label}</span>)}
        <span className="ml-auto">{data[0].date} → {data[data.length - 1].date}</span>
      </figcaption>
    </figure>
  )
}

export function BarList({ items, labels }: { items: { source: string; count: number }[]; labels?: boolean }) {
  const total = items.reduce((s, i) => s + i.count, 0)
  if (!items.length) return <p className="py-6 text-sm text-muted-foreground">No data yet.</p>
  const max = Math.max(...items.map((i) => i.count))
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.source}>
          <div className="mb-1 flex justify-between text-sm"><span>{labels ? (TRAFFIC_SOURCE_LABELS[i.source] ?? i.source) : i.source}</span><span className="tabular-nums text-muted-foreground">{formatCount(i.count)}{total ? ` · ${Math.round((i.count / total) * 100)}%` : ""}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand-gradient" style={{ width: `${(i.count / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  )
}
