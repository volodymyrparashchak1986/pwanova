"use client"

import { useSyncExternalStore } from "react"
import { detectBrowser, detectPlatform } from "./platform"

const noop = () => () => {}

/** Client-only device detection that is hydration-safe (server snapshot is a neutral default). */
export function usePlatform() {
  const platform = useSyncExternalStore(noop, () => detectPlatform(), () => "desktop" as const)
  const browser = useSyncExternalStore(noop, () => detectBrowser(), () => "other" as const)
  return { platform, browser }
}
