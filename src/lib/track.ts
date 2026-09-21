import type { EventType } from "./constants"

/** Fire-and-forget event ping. Install clicks are intents, not confirmed installs. */
export function track(appId: string, type: EventType, from?: string | null) {
  try {
    const body = JSON.stringify({ appId, type, from: from ?? null, referrer: document.referrer || null })
    if (navigator.sendBeacon) navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }))
    else fetch("/api/events", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {})
  } catch { /* analytics must never break the UI */ }
}
