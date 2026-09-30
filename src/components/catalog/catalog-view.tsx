import { Suspense } from "react"
import { Search } from "lucide-react"
import { EmptyState } from "@/components/app/section-header"
import { AppCard } from "./app-card"
import { FilterChip, FilterSheet, FilterSidebar, SortSelect } from "./filter-panel"
import { Pagination } from "./pagination"
import { Link } from "@/components/i18n/link"
import { buttonVariants } from "@/components/ui/button"
import { fmt, plural } from "@/i18n/format"
import { getI18n } from "@/i18n/server"
import { getViewer } from "@/lib/data"
import { getSavedIds } from "@/lib/data/account"
import { getCategories, getFacetCounts, getFactRegistry, getIntegrationCatalog, getPublicSettings, getSponsorSlots, getUseCases, searchCatalog } from "@/lib/data/catalog"
import { activeFilters, buildFilterGroups } from "@/lib/v2/filter-groups"
import { activeFilterCount, catalogHref, SORTS, type CatalogState } from "@/lib/v2/params"
import type { CatalogFilters } from "@/lib/v2/types"
import { cn } from "@/lib/utils"

/**
 * Search field, filters, sorting, results and pagination for one catalogue. The discover page uses
 * it for everything; a category page fixes the category and offers the remaining filters.
 */
export async function CatalogView({ state, base, fixed = {}, autoFocus = false, sponsorPlacement }: {
  state: CatalogState; base: string; fixed?: CatalogFilters; autoFocus?: boolean; sponsorPlacement?: { placement: "discover" | "category"; categoryId?: string }
}) {
  const [{ t, locale, href }, viewer, settings] = await Promise.all([getI18n(), getViewer(), getPublicSettings()])
  const filters: CatalogFilters = { ...state.filters, ...fixed }
  const [result, facets, registry, categories, useCases, integrations, saved, sponsors] = await Promise.all([
    searchCatalog({ q: state.q, filters, sort: state.sort, page: state.page, pageSize: 24 }),
    getFacetCounts(), getFactRegistry(), getCategories(), getUseCases(), getIntegrationCatalog(), getSavedIds(viewer?.id ?? null),
    sponsorPlacement && state.page === 1 ? getSponsorSlots(sponsorPlacement.placement, sponsorPlacement.categoryId) : Promise.resolve([]),
  ])
  const hideCategory = Boolean(fixed.categories?.length)
  const groups = buildFilterGroups({ t, locale, facets, categories, registry, useCases, integrations, filters: state.filters, hideCategory })
  const chips = activeFilters({ t, locale, filters: state.filters, categories, registry, useCases, integrations })
  const active = activeFilterCount(state.filters)
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize))
  const from = state.q ? "search" : undefined
  const hrefFor = (page: number) => catalogHref({ ...state, page }, base)
  const sponsoredApps = sponsors.filter((s) => s.app && !result.apps.some((a) => a.id === s.app!.id))

  return (
    <>
      <form action={href(base)} role="search" className="flex items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-5 shadow-soft">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input name="q" type="search" defaultValue={state.q} maxLength={80} autoFocus={autoFocus} placeholder={t.nav.searchPlaceholder} aria-label={t.discover.searchLabel} className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground" />
        {/* keep the active filters when the search text changes */}
        {[...new URLSearchParams(catalogHref({ ...state, q: "", page: 1 }, "").replace(/^\?/, "")).entries()].map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <button type="submit" className={cn(buttonVariants(), "h-11 rounded-full px-5")}>{t.common.search}</button>
      </form>

      <div className="mt-8 lg:flex lg:gap-10">
        <Suspense><FilterSidebar groups={groups} active={active} /></Suspense>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 text-sm break-words text-muted-foreground" aria-live="polite">
              {state.q ? fmt(t.discover.resultsFor, { count: plural(locale, result.total, t.filters.results), query: state.q }) : plural(locale, result.total, t.filters.results)}
            </p>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Suspense><FilterSheet groups={groups} active={active} total={result.total} /></Suspense>
              <Suspense><SortSelect value={state.sort} options={SORTS.map((s) => ({ value: s, label: t.filters.sorts[s] }))} /></Suspense>
            </div>
          </div>
          {chips.length > 0 && (
            <ul className="mt-3 flex flex-wrap items-center gap-2" aria-label={t.filters.selected}>
              {chips.map((c) => <li key={c.key}><FilterChip label={c.label} removeLabel={fmt(t.filters.removeFilter, { name: c.label })} href={href(catalogHref({ ...state, filters: c.remove, page: 1 }, base))} /></li>)}
              <li><Link href={catalogHref({ q: state.q, sort: state.sort }, base)} className="text-xs font-medium text-brand hover:underline">{t.filters.clear}</Link></li>
            </ul>
          )}

          {sponsoredApps.length > 0 && (
            <section aria-label={t.discover.sponsored} className="mt-5 rounded-3xl border border-dashed border-border p-3">
              <div className="grid gap-4 sm:grid-cols-2">{sponsoredApps.map((s) => <AppCard key={s.id} app={s.app!} sponsored signedIn={Boolean(viewer)} saved={saved.has(s.app!.id)} compareEnabled={settings.features.compare} />)}</div>
            </section>
          )}

          {result.apps.length ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.apps.map((a) => <AppCard key={a.id} app={a} from={from} signedIn={Boolean(viewer)} saved={saved.has(a.id)} compareEnabled={settings.features.compare} />)}
            </div>
          ) : (
            <EmptyState className="mt-5" title={t.discover.emptyTitle} body={t.discover.emptyBody}>
              {(active > 0 || state.q) && <Link href={base} className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}>{t.discover.resetCta}</Link>}
              {settings.features.requests && <Link href="/requests/new" className={cn(buttonVariants(), "rounded-full")}>{t.discover.emptyCta}</Link>}
            </EmptyState>
          )}
          <Pagination page={result.page} pages={pages} hrefFor={hrefFor} t={t} />
          <p className="mt-8 text-xs text-muted-foreground">{t.discover.organicNote} <Link href="/how-ranking-works" className="font-medium text-brand hover:underline">{t.discover.organicLink}</Link></p>
        </div>
      </div>
    </>
  )
}
