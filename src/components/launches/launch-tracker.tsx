"use client"

import { useEffect } from "react"
import { track } from "@/lib/track"

/** Reports a view of a launch page. Only signed-in, distinct people count towards a launch; nothing is stored in the browser. */
export function LaunchTracker({ appId }: { appId: string }) {
  useEffect(() => { track(appId, "launch_view", "launch") }, [appId])
  return null
}
