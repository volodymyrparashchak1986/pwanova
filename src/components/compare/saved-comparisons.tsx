import { DeleteComparison } from "./delete-comparison"
import { Link } from "@/components/i18n/link"
import { formatDate } from "@/i18n/format"
import { getI18n } from "@/i18n/server"
import type { SavedComparison } from "@/lib/data/account"

export async function SavedComparisons({ items }: { items: SavedComparison[] }) {
  if (!items.length) return null
  const { t, locale } = await getI18n()
  return (
    <section className="mt-12" aria-labelledby="saved-comparisons-h">
      <h2 id="saved-comparisons-h" className="text-xl font-semibold tracking-tight">{t.compare.savedList}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.compare.saveHint}</p>
      <ul className="mt-4 divide-y divide-border/70 rounded-3xl border border-border bg-card px-5">
        {items.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <Link href={`/compare/${c.key}`} className="min-w-0 font-medium hover:underline">{c.title || c.apps.map((a) => a.name).join(` ${t.compare.vs} `)}</Link>
            <span className="flex items-center gap-3 text-xs text-muted-foreground"><time dateTime={c.createdAt}>{formatDate(locale, c.createdAt)}</time><DeleteComparison id={c.id} /></span>
          </li>
        ))}
      </ul>
    </section>
  )
}
