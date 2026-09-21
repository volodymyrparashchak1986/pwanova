/* PWANova service worker: offline fallback + static asset caching. Bump VERSION to invalidate. */
const VERSION = "v1"
const STATIC = `pwanova-static-${VERSION}`
const PAGES = `pwanova-pages-${VERSION}`

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.add("/offline")).then(() => self.skipWaiting()))
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![STATIC, PAGES].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // never cache API, auth or personalised routes
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline")))
    return
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      }),
    )
  }
})
