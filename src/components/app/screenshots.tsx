import { hueFor } from "@/lib/format"

/** Horizontal swipe strip. Uses real screenshots when present, otherwise generated placeholders. */
export function Screenshots({ app }: { app: { slug: string; name: string; screenshots: string[] } }) {
  const h = hueFor(app.slug)
  const items = app.screenshots.length ? app.screenshots : [0, 1, 2, 3]
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0" aria-label="Screenshots">
      {items.map((s, i) => (
        <div key={i} className="aspect-[9/19] w-44 shrink-0 snap-center overflow-hidden rounded-[1.6rem] border border-border bg-card shadow-soft md:w-52">
          {typeof s === "string" ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote screenshots
            <img src={s} alt={`${app.name} screenshot ${i + 1}`} loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
          ) : (
            <div className="flex size-full flex-col gap-2.5 p-3.5" style={{ backgroundImage: `linear-gradient(160deg, oklch(0.93 0.05 ${(h + i * 30) % 360}), oklch(0.85 0.09 ${(h + 60 + i * 30) % 360}))` }} role="img" aria-label="Placeholder screenshot">
              <div className="h-3 w-1/3 rounded-full bg-black/15" />
              <div className="mt-2 h-24 rounded-2xl bg-white/60" />
              {Array.from({ length: 4 + (i % 2) }).map((_, k) => <div key={k} className="h-9 rounded-xl bg-white/50" style={{ width: `${100 - k * 6}%` }} />)}
              <div className="mt-auto h-10 rounded-full bg-black/20" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
