"use client"

import { useId, useMemo, useOptimistic, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useI18n } from "@/i18n/client"
import { fmt, formatNumber, plural } from "@/i18n/format"
import { cn } from "@/lib/utils"

export interface FilterOption { value: string; label: string; count: number; hint?: string }
export interface FilterGroup {
  id: string
  title: string
  /** `multi`: comma separated values in one parameter. `flag`: each option is its own ?param=1. `single`: one value. */
  kind: "multi" | "flag" | "single"
  param: string
  options: FilterOption[]
  help?: string
}

const COLLAPSED = 6

function useFilterState() {
  const router = useRouter()
  const pathname = usePathname()
  const address = useSearchParams()
  const [pending, start] = useTransition()
  // a box is ticked at once and the results follow; when the address has changed, the address is the state again
  const [shown, setShown] = useOptimistic(address.toString())
  const params = useMemo(() => new URLSearchParams(shown), [shown])
  const go = (next: URLSearchParams) => {
    next.delete("page") // a changed filter starts at the first page again
    const qs = next.toString().replace(/%2C/g, ",")
    start(() => {
      setShown(next.toString())
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }
  const values = (param: string) => (params.get(param) ?? "").split(",").filter(Boolean)
  const isOn = (g: FilterGroup, o: FilterOption) => (g.kind === "flag" ? params.get(o.value) !== null : values(g.param).includes(o.value))
  const toggle = (g: FilterGroup, o: FilterOption) => {
    const next = new URLSearchParams(params)
    if (g.kind === "flag") {
      if (next.get(o.value) !== null) next.delete(o.value); else next.set(o.value, o.hint ?? "1")
    } else if (g.kind === "single") {
      if (next.get(g.param) === o.value) next.delete(g.param); else next.set(g.param, o.value)
    } else {
      const current = values(g.param)
      const list = current.includes(o.value) ? current.filter((v) => v !== o.value) : [...current, o.value]
      if (list.length) next.set(g.param, list.sort().join(",")); else next.delete(g.param)
    }
    go(next)
  }
  const clear = () => {
    const next = new URLSearchParams()
    for (const keep of ["q", "sort"]) { const v = params.get(keep); if (v) next.set(keep, v) }
    go(next)
  }
  return { pending, isOn, toggle, clear }
}

function Group({ group, state }: { group: FilterGroup; state: ReturnType<typeof useFilterState> }) {
  const { t, locale } = useI18n()
  const [all, setAll] = useState(false)
  // the sidebar and the sheet show the same groups on one page, so an id has to name its panel as well
  const uid = useId()
  const selected = group.options.filter((o) => state.isOn(group, o))
  // selected options always stay visible, also when the list is collapsed
  const shown = all ? group.options : [...new Set([...group.options.slice(0, COLLAPSED), ...selected])]
  return (
    <fieldset className="border-b border-border/70 py-4 first:pt-0 last:border-0">
      <legend className="mb-2 float-left w-full text-sm font-semibold">{group.title}</legend>
      {group.help && <p className="clear-both mb-2 text-xs text-muted-foreground">{group.help}</p>}
      <ul className="clear-both space-y-1">
        {shown.map((o) => {
          const on = state.isOn(group, o)
          const id = `${uid}-${group.id}-${o.value}`
          return (
            <li key={o.value}>
              <label htmlFor={id} className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-sm hover:bg-muted/70", on && "font-medium")}>
                <input id={id} type="checkbox" checked={on} onChange={() => state.toggle(group, o)} className="size-4 shrink-0 rounded border-border accent-[var(--brand)]" />
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{formatNumber(locale, o.count)}</span>
              </label>
            </li>
          )
        })}
      </ul>
      {group.options.length > shown.length && !all && (
        <button type="button" onClick={() => setAll(true)} className="mt-1.5 px-1.5 text-xs font-medium text-brand hover:underline">{fmt(t.filters.showAll, { count: group.options.length })}</button>
      )}
      {all && group.options.length > COLLAPSED && (
        <button type="button" onClick={() => setAll(false)} className="mt-1.5 px-1.5 text-xs font-medium text-brand hover:underline">{t.common.showLess}</button>
      )}
    </fieldset>
  )
}

function Panel({ groups, active, state }: { groups: FilterGroup[]; active: number; state: ReturnType<typeof useFilterState> }) {
  const { t, locale } = useI18n()
  return (
    <div className={cn("transition-opacity", state.pending && "opacity-60")} aria-busy={state.pending}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{t.filters.title}</h2>
        {active > 0 && <button type="button" onClick={state.clear} className="text-xs font-medium text-brand hover:underline">{t.filters.clear}</button>}
      </div>
      {active > 0 && <p className="mb-2 text-xs text-muted-foreground">{plural(locale, active, t.filters.active)}</p>}
      {groups.map((g) => <Group key={g.id} group={g} state={state} />)}
    </div>
  )
}

/** The filters beside the results, on wide screens. Every change is a URL, so a filtered view can be shared. */
export function FilterSidebar({ groups, active }: { groups: FilterGroup[]; active: number }) {
  const { t } = useI18n()
  const state = useFilterState()
  return (
    <aside className="hidden w-64 shrink-0 lg:block" aria-label={t.filters.title}>
      <div className="no-scrollbar sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pr-1"><Panel groups={groups.filter((g) => g.options.length > 0)} active={active} state={state} /></div>
    </aside>
  )
}

/** The same filters in a bottom sheet, on phones and tablets. The button belongs in the toolbar above the results. */
export function FilterSheet({ groups, active, total }: { groups: FilterGroup[]; active: number; total: number }) {
  const { t, locale } = useI18n()
  const state = useFilterState()
  const [open, setOpen] = useState(false)
  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="outline" className="h-10 rounded-full" />}>
          <SlidersHorizontal className="size-4" />{t.filters.title}{active > 0 && <span className="grid size-5 place-items-center rounded-full bg-brand text-[11px] font-semibold text-white">{active}</span>}
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[88dvh] rounded-t-3xl p-0">
          <SheetHeader className="sr-only"><SheetTitle>{t.filters.title}</SheetTitle></SheetHeader>
          <div className="overflow-y-auto px-5 pt-6 pb-4"><Panel groups={groups.filter((g) => g.options.length > 0)} active={active} state={state} /></div>
          <div className="pb-safe border-t border-border bg-background px-5 pt-3">
            <Button size="lg" className="mb-3 w-full rounded-full" onClick={() => setOpen(false)}>{t.filters.apply} · {plural(locale, total, t.filters.results)}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export function SortSelect({ value, options }: { value: string; options: { value: string; label: string }[] }) {
  const { t } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, start] = useTransition()
  const [shown, setShown] = useOptimistic(value)
  return (
    <label className="inline-flex min-w-0 items-center gap-2 text-sm">
      {/* on a phone the chosen order names itself; the label stays for screen readers */}
      <span className="sr-only text-muted-foreground sm:not-sr-only">{t.filters.sort}</span>
      <select
        value={shown}
        aria-busy={pending}
        onChange={(e) => {
          const sort = e.target.value
          const next = new URLSearchParams(params)
          if (sort === "relevance") next.delete("sort"); else next.set("sort", sort)
          next.delete("page")
          const qs = next.toString().replace(/%2C/g, ",")
          start(() => {
            setShown(sort)
            router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
          })
        }}
        className="h-10 max-w-full min-w-0 rounded-full border border-input bg-background px-3 text-sm font-medium"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}

export function FilterChip({ label, removeLabel, href }: { label: string; removeLabel: string; href: string }) {
  const router = useRouter()
  return (
    <button type="button" onClick={() => router.push(href, { scroll: false })} aria-label={removeLabel} className="inline-flex items-center gap-1 rounded-full bg-muted py-1 pr-2 pl-3 text-xs font-medium hover:bg-muted/70">
      {label}<X className="size-3 text-muted-foreground" aria-hidden />
    </button>
  )
}
