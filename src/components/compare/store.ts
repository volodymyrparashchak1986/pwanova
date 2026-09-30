"use client"

import { useSyncExternalStore } from "react"
import { MAX_COMPARE } from "@/lib/v2/compare"

export interface CompareItem { id: string; slug: string; name: string; iconUrl: string | null }

const KEY = "pwn:compare"
const EVENT = "pwn:compare"
const EMPTY: CompareItem[] = []

let cachedRaw: string | null | undefined
let cached: CompareItem[] = EMPTY

const valid = (i: unknown): i is CompareItem => {
  const x = i as CompareItem
  return Boolean(x) && typeof x.id === "string" && typeof x.slug === "string" && /^[a-z0-9-]{1,80}$/.test(x.slug) && typeof x.name === "string" && x.name.length <= 120
    && (x.iconUrl === null || typeof x.iconUrl === "string")
}

/** getSnapshot must return the same array while nothing changed, so the parsed value is cached by its raw string. */
function read(): CompareItem[] {
  let raw: string | null = null
  try { raw = window.localStorage.getItem(KEY) } catch { /* storage disabled: the comparison lives for this page only */ }
  if (raw === cachedRaw) return cached
  cachedRaw = raw
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : []
    cached = Array.isArray(parsed) ? parsed.filter(valid).slice(0, MAX_COMPARE) : EMPTY
  } catch { cached = EMPTY }
  return cached
}

function write(items: CompareItem[]) {
  const next = items.slice(0, MAX_COMPARE)
  try { window.localStorage.setItem(KEY, JSON.stringify(next)) } catch { cachedRaw = undefined; cached = next }
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback)
  window.addEventListener(EVENT, callback)
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(EVENT, callback) }
}

export const compareStore = {
  add(item: CompareItem): boolean {
    const items = read()
    if (items.some((i) => i.slug === item.slug)) return true
    if (items.length >= MAX_COMPARE) return false
    write([...items, item])
    return true
  },
  remove(slug: string) { write(read().filter((i) => i.slug !== slug)) },
  replace(items: CompareItem[]) {
    const current = read()
    if (current.length === items.length && current.every((c, i) => c.slug === items[i].slug)) return
    write(items)
  },
  clear() { write([]) },
}

/** The apps currently selected for comparison. Empty on the server and during hydration. */
export function useCompare(): CompareItem[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY)
}
