"use client"

import { useEffect } from "react"
import { track } from "@/lib/track"

/** Logs one `view` per app per browser session. */
export function ViewTracker({ appId, from }: { appId: string; from?: string }) {
  useEffect(() => {
    const key = `pwn:v:${appId}`
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1") } catch { /* private mode */ }
    track(appId, "view", from)
  }, [appId, from])
  return null
}
