"use client"

import { useEffect } from "react"

/** Registers the PWANova service worker (production only) so PWANova itself is an installable web app. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js").catch(() => {})
  }, [])
  return null
}
