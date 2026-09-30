"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { BookmarkPlus, Link2, Loader2, Plus, Search, X } from "lucide-react"
import { toast } from "sonner"
import { AppIcon } from "@/components/app/app-icon"
import { EmptyState } from "@/components/app/section-header"
import { Link } from "@/components/i18n/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { compareStore, useCompare, type CompareItem } from "./store"
import { saveComparison } from "@/actions/account"
import { suggestApps, type AppSuggestion } from "@/actions/catalog"
import { useI18n } from "@/i18n/client"
import { fmt } from "@/i18n/format"
import { comparisonKey, MAX_COMPARE } from "@/lib/v2/compare"
import { cn } from "@/lib/utils"

/** Keeps the selection in the browser equal to what the page shows, so the tray and the buttons agree with the URL. */
export function CompareSync({ items }: { items: CompareItem[] }) {
  useEffect(() => { compareStore.replace(items) }, [items])
  return null
}

/** Search by name and add an app. `current` are the slugs already compared; the result is a new URL. */
export function CompareAdd({ current }: { current: string[] }) {
  const { t, href } = useI18n()
  const router = useRouter()
  const [q, setQ] = useState("")
  const [results, setResults] = useState<AppSuggestion[] | null>(null)
  const [pending, start] = useTransition()
  const latest = useRef(0)
  if (current.length >= MAX_COMPARE) return <p className="text-sm text-muted-foreground">{t.compare.max}</p>

  const search = (value: string) => {
    setQ(value)
    const id = ++latest.current
    if (value.trim().length < 2) { setResults(null); return }
    start(async () => {
      const found = await suggestApps(value)
      if (id === latest.current) setResults(found.filter((f) => !current.includes(f.slug)))
    })
  }
  const add = (s: AppSuggestion) => {
    const slugs = [...current, s.slug]
    compareStore.add({ id: s.id, slug: s.slug, name: s.name, iconUrl: s.iconUrl })
    setQ(""); setResults(null)
    router.push(href(slugs.length >= 2 ? `/compare/${comparisonKey(slugs)}` : "/compare"))
  }
  return (
    <div className="relative max-w-md">
      <label className="flex items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-4">
        {pending ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden /> : <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
        <span className="sr-only">{t.compare.add}</span>
        <input type="search" value={q} maxLength={60} onChange={(e) => search(e.target.value)} placeholder={`${t.compare.add}: ${t.compare.addPlaceholder}`} className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      </label>
      {results && (
        <ul className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-border bg-popover shadow-soft" aria-label={t.compare.add}>
          {results.length === 0 && <li className="p-3 text-sm text-muted-foreground">{t.compare.noResults}</li>}
          {results.map((r) => (
            <li key={r.slug}>
              <button type="button" onClick={() => add(r)} className="flex w-full items-center gap-3 p-2.5 text-left hover:bg-muted">
                <AppIcon app={r} size="sm" className="size-9! rounded-[10px]! text-sm!" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{r.name}</span><span className="block truncate text-xs text-muted-foreground">{r.tagline}</span></span>
                <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function CompareToolbar({ slugs, signedIn }: { slugs: string[]; signedIn: boolean }) {
  const { t, href } = useI18n()
  const router = useRouter()
  const [pending, start] = useTransition()
  const path = href(`/compare/${comparisonKey(slugs)}`)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" className="rounded-full" onClick={async () => {
        const url = `${location.origin}${path}`
        try {
          if (navigator.share) await navigator.share({ title: document.title, url })
          else { await navigator.clipboard.writeText(url); toast.success(t.common.linkCopied) }
        } catch { /* closed by the visitor */ }
      }}><Link2 className="size-4" />{t.compare.shareTitle}</Button>
      <Button variant="outline" className="rounded-full" disabled={pending} title={t.compare.saveHint} onClick={() => {
        if (!signedIn) { toast.info(t.compare.signInToSave); router.push(`${href("/sign-in")}?next=${encodeURIComponent(path)}`); return }
        start(async () => {
          const r = await saveComparison(slugs)
          if (r.ok) toast.success(t.compare.savedComparison); else toast.error(r.error)
        })
      }}><BookmarkPlus className="size-4" />{t.compare.saveComparison}</Button>
      <Button variant="ghost" className="rounded-full text-muted-foreground" onClick={() => { compareStore.clear(); router.push(href("/compare")) }}>{t.compare.clear}</Button>
    </div>
  )
}

/** /compare without apps in the address: continues with the selection from this browser, or explains how to start. */
export function CompareStart() {
  const { t, href } = useI18n()
  const router = useRouter()
  const items = useCompare()
  useEffect(() => {
    if (items.length >= 2) router.replace(href(`/compare/${comparisonKey(items.map((i) => i.slug))}`))
  }, [items, router, href])
  if (items.length >= 2) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />{t.common.loading}</p>
  return (
    <div className="space-y-6">
      {items.length === 1 && (
        <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-border bg-card p-4">
          <AppIcon app={items[0]} size="sm" />
          <p className="min-w-0 flex-1 text-sm"><span className="font-semibold">{items[0].name}</span><span className="block text-muted-foreground">{t.compare.needTwo} {fmt(t.compare.addMore, { count: MAX_COMPARE - 1 })}</span></p>
          <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => compareStore.clear()}>{t.common.remove}</button>
        </div>
      )}
      <CompareAdd current={items.map((i) => i.slug)} />
      {items.length === 0 && (
        <EmptyState title={t.compare.empty} body={t.compare.emptyBody}>
          <Link href="/discover" className={cn(buttonVariants(), "rounded-full")}>{t.compare.emptyCta}</Link>
        </EmptyState>
      )}
    </div>
  )
}

/** Removes one app from the comparison: from the selection in this browser and from the address. */
export function CompareRemove({ slug, name, rest }: { slug: string; name: string; rest: string[] }) {
  const { t, href } = useI18n()
  const router = useRouter()
  const label = fmt(t.compare.remove, { name })
  return (
    <button type="button" aria-label={label} title={label} className="absolute top-2 right-2 grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      onClick={() => { compareStore.remove(slug); router.push(href(rest.length >= 2 ? `/compare/${comparisonKey(rest)}` : "/compare")) }}>
      <X className="size-4" />
    </button>
  )
}
