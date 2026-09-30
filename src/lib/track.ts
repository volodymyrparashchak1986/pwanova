import type { EventType } from "./constants"

/**
 * Fire-and-forget first-party event. No cookie, no browser storage, no identifier: the server keeps the
 * event type, the traffic source and the language edition. Repeated events are dropped on the server.
 * Install clicks are intents, not confirmed installs.
 */
export function track(appId: string, type: EventType, from?: string | null) {
  try {
    const locale = document.documentElement.lang || null
    // partner attribution travels in the address (?ref=…) of the page somebody arrived on; nothing is stored
    const ref = new URLSearchParams(location.search).get("ref")
    const body = JSON.stringify({ appId, type, from: from ?? null, referrer: document.referrer || null, locale, ref: ref && /^[a-z0-9_-]{2,40}$/i.test(ref) ? ref.toLowerCase() : null })
    if (navigator.sendBeacon) navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }))
    else fetch("/api/events", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {})
  } catch { /* analytics must never break the UI */ }
}
