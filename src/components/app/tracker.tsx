"use client"

import { useEffect } from "react"
import { track } from "@/lib/track"

/** Reports a profile view. The server counts one per visitor and half hour; nothing is stored in the browser. */
export function ViewTracker({ appId, from }: { appId: string; from?: string }) {
  useEffect(() => {
    track(appId, "view", from)
  }, [appId, from])
  return null
}
