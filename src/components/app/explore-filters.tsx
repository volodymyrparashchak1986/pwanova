"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { Search, SlidersHorizontal, X } from "lucide-react"
import { BUILD_TOOLS, CATEGORIES, HOSTS, LAUNCH_SOURCES } from "@/lib/constants"
import { cn } from "@/lib/utils"

const SORTS = [
  ["top", "Top"], ["trending", "Trending"], ["rating", "Top rated"], ["new", "Newest"],
] as const

const selectCls = "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring"

export function ExploreFilters({ autoFocus }: { autoFocus?: boolean }) {
  const router = useRouter()
  const path = usePathname()
  const sp = useSearchParams()
  const [pending, start] = useTransition()
  const [q, setQ] = useState(sp.get("q") ?? "")
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => { if (autoFocus) inputRef.current?.focus() }, [autoFocus])

  function set(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString())
    next.delete("focus")
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k) }
    start(() => router.replace(`${path}?${next.toString()}`, { scroll: false }))
  }
  // debounce free-text search
  useEffect(() => {
    if (q === (sp.get("q") ?? "")) return
    const t = setTimeout(() => set({ q: q.trim() || null }), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const active = ["category", "rating", "build", "host", "launch", "verified", "installable", "pwa"].filter((k) => sp.get(k)).length
  const sort = sp.get("sort") ?? (sp.get("q") ? "top" : "top")
  const toggle = (key: string, label: string) => (
    <button
      type="button" aria-pressed={sp.get(key) === "1"}
      onClick={() => set({ [key]: sp.get(key) === "1" ? null : "1" })}
      className={cn("rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors", sp.get(key) === "1" ? "border-brand bg-brand/10 text-brand" : "border-border text-muted-foreground hover:text-foreground")}
    >{label}</button>
  )

  return (
    <div className={cn("space-y-4 transition-opacity", pending && "opacity-70")}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} type="search" inputMode="search" enterKeyHint="search"
          placeholder="Search by name, builder, category, tool, host…" aria-label="Search apps"
          className="h-14 w-full rounded-2xl border border-input bg-card pr-12 pl-12 text-base outline-none shadow-soft transition-colors placeholder:text-muted-foreground focus:border-ring"
        />
        {q && <button type="button" aria-label="Clear search" onClick={() => { setQ(""); set({ q: null }) }} className="absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground"><X className="size-5" /></button>}
      </div>

      <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4">
        {SORTS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => set({ sort: k === "top" ? null : k })} aria-pressed={sort === k}
            className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors", sort === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>{label}</button>
        ))}
        <span className="mx-1 h-5 w-px shrink-0 bg-border" />
        <div className="flex shrink-0 gap-2">{toggle("verified", "Verified")}{toggle("installable", "Installable")}{toggle("pwa", "PWA")}</div>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-sm font-medium">
          <SlidersHorizontal className="size-4" />Filters{active > 0 && <span className="grid size-5 place-items-center rounded-full bg-brand text-[11px] text-white">{active}</span>}
        </button>
      </div>

      {open && (
        <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">Category
            <select className={selectCls} value={sp.get("category") ?? ""} onChange={(e) => set({ category: e.target.value || null })}>
              <option value="">All categories</option>{CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select></label>
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">Rating
            <select className={selectCls} value={sp.get("rating") ?? ""} onChange={(e) => set({ rating: e.target.value || null })}>
              <option value="">Any rating</option><option value="3">3.0 ★ &amp; up</option><option value="4">4.0 ★ &amp; up</option><option value="4.5">4.5 ★ &amp; up</option>
            </select></label>
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">Built with
            <select className={selectCls} value={sp.get("build") ?? ""} onChange={(e) => set({ build: e.target.value || null })}>
              <option value="">Any tool</option>{BUILD_TOOLS.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
            </select></label>
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">Hosted on
            <select className={selectCls} value={sp.get("host") ?? ""} onChange={(e) => set({ host: e.target.value || null })}>
              <option value="">Any host</option>{HOSTS.map((h) => <option key={h.slug} value={h.slug}>{h.name}</option>)}
            </select></label>
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">Launch source
            <select className={selectCls} value={sp.get("launch") ?? ""} onChange={(e) => set({ launch: e.target.value || null })}>
              <option value="">Any source</option>{LAUNCH_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select></label>
          {active > 0 && <button type="button" onClick={() => set({ category: null, rating: null, build: null, host: null, launch: null, verified: null, installable: null, pwa: null })} className="self-end rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">Clear filters</button>}
        </div>
      )}
    </div>
  )
}
