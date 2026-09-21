import "server-only"
import { safeFetch } from "@/lib/security/ssrf"
import { cleanHttpUrl, cleanText } from "@/lib/security/sanitize"
import { domainOf, parsePublicUrl } from "@/lib/url"
import type { HostProvider } from "@/lib/constants"
import { detectHost } from "@/lib/analyzer-host"

export interface AnalysisResult {
  url: string
  finalUrl: string
  domain: string
  reachable: boolean
  title: string
  description: string
  iconUrl: string | null
  ogImage: string | null
  themeColor: string | null
  manifestUrl: string | null
  screenshots: string[]
  host: HostProvider
  hostSignal: string | null
  isPwa: boolean
  isInstallable: boolean
  checks: {
    reachable: boolean
    https_ok: boolean
    responsive: boolean
    mobile_optimized: boolean
    manifest_ok: boolean
    service_worker_ok: boolean | null
    installable: boolean
    offline_support: boolean | null // not determinable without running the app; never guessed
    push_support: boolean | null
    security_ok: boolean
    status_code: number | null
    response_ms: number | null
  }
  notes: string[]
}

// ---- tiny HTML helpers (no DOM available server-side; we never execute remote code) ----
function tags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? []
}
function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))
  return m ? (m[1] ?? m[2] ?? m[3] ?? "").trim() : null
}
function metaContent(html: string, key: string, by: "name" | "property" = "name"): string | null {
  for (const t of tags(html, "meta")) if (attr(t, by)?.toLowerCase() === key) return attr(t, "content")
  return null
}
function linkHref(html: string, relMatch: (rel: string) => boolean): { href: string; tag: string }[] {
  return tags(html, "link")
    .filter((t) => relMatch((attr(t, "rel") ?? "").toLowerCase()))
    .map((t) => ({ href: attr(t, "href") ?? "", tag: t }))
    .filter((l) => l.href)
}
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
const abs = (href: string | null | undefined, base: string) => {
  if (!href) return null
  try { return cleanHttpUrl(new URL(decode(href), base).href) } catch { return null }
}

const SW_PATHS = ["/sw.js", "/service-worker.js", "/serviceworker.js"]

/** Analyze a public URL server-side. Never executes remote code; only parses HTML/JSON. */
export async function analyzeUrl(input: string): Promise<AnalysisResult> {
  const start = parsePublicUrl(input)
  const notes: string[] = []
  const empty: AnalysisResult = {
    url: start.href, finalUrl: start.href, domain: domainOf(start), reachable: false, title: "", description: "", iconUrl: null,
    ogImage: null, themeColor: null, manifestUrl: null, screenshots: [], host: "custom-domain", hostSignal: null, isPwa: false, isInstallable: false,
    checks: { reachable: false, https_ok: start.protocol === "https:", responsive: false, mobile_optimized: false, manifest_ok: false, service_worker_ok: null, installable: false, offline_support: null, push_support: null, security_ok: false, status_code: null, response_ms: null },
    notes,
  }

  let page
  try {
    page = await safeFetch(start)
  } catch (e) {
    notes.push(e instanceof Error ? e.message : "Could not reach the URL.")
    return empty
  }
  const final = new URL(page.finalUrl)
  const html = page.body
  const reachable = page.status >= 200 && page.status < 400
  const { host, signal } = detectHost(final, page.headers)

  const title = decode(cleanText(metaContent(html, "og:title", "property") ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "", 120))
  const description = decode(cleanText(metaContent(html, "og:description", "property") ?? metaContent(html, "description") ?? "", 400))
  const viewport = metaContent(html, "viewport") ?? ""
  const themeColor = metaContent(html, "theme-color")
  const ogImage = abs(metaContent(html, "og:image", "property"), page.finalUrl)
  const appleIcon = linkHref(html, (r) => r.includes("apple-touch-icon"))[0]?.href
  const iconLink = linkHref(html, (r) => r.split(/\s+/).includes("icon") || r === "shortcut icon")[0]?.href

  // manifest
  const manifestHref = linkHref(html, (r) => r === "manifest")[0]?.href
  const manifestUrl = abs(manifestHref, page.finalUrl)
  let manifest: Record<string, unknown> | null = null
  if (manifestUrl) {
    try {
      const m = await safeFetch(manifestUrl, { maxBytes: 200_000, accept: "application/manifest+json,application/json" })
      if (m.status === 200) manifest = JSON.parse(m.body)
    } catch { notes.push("Manifest could not be fetched or parsed.") }
  }
  const icons = Array.isArray(manifest?.icons) ? (manifest!.icons as { src?: string; sizes?: string }[]) : []
  const largest = [...icons].sort((a, b) => parseInt(b.sizes ?? "0") - parseInt(a.sizes ?? "0"))[0]
  const has192 = icons.some((i) => (i.sizes ?? "").split(/\s+/).some((s) => parseInt(s) >= 192))
  const has512 = icons.some((i) => (i.sizes ?? "").split(/\s+/).some((s) => parseInt(s) >= 512))
  const display = String(manifest?.display ?? "")
  const manifestOk = Boolean(manifest && (manifest.name || manifest.short_name) && manifest.start_url !== undefined)
  const manifestBase = manifestUrl ?? page.finalUrl
  const screenshots = (Array.isArray(manifest?.screenshots) ? (manifest!.screenshots as { src?: string }[]) : [])
    .map((s) => abs(s.src, manifestBase)).filter((s): s is string => Boolean(s)).slice(0, 6)

  // service worker: heuristic. We look for a registration in the HTML or a common SW file. Not proof of offline support.
  let serviceWorker: boolean | null = /serviceWorker\s*\.\s*register|navigator\.serviceWorker/.test(html) ? true : null
  if (!serviceWorker) {
    for (const p of SW_PATHS) {
      try {
        const r = await safeFetch(new URL(p, final.origin), { maxBytes: 20_000, timeoutMs: 4000, accept: "application/javascript,*/*" })
        if (r.status === 200 && /javascript|ecmascript/.test(r.headers.get("content-type") ?? "")) { serviceWorker = true; break }
      } catch { /* ignore */ }
    }
    if (!serviceWorker) { serviceWorker = false; notes.push("No service worker detected at common paths (heuristic).") }
  }

  const https = final.protocol === "https:"
  const responsive = /width\s*=\s*device-width/i.test(viewport)
  const installable = https && manifestOk && ["standalone", "fullscreen", "minimal-ui"].includes(display) && (has192 || has512) && serviceWorker === true
  const iconRaw = largest?.src ? abs(largest.src, manifestBase) : abs(appleIcon, page.finalUrl) ?? abs(iconLink, page.finalUrl) ?? abs("/favicon.ico", page.finalUrl)

  return {
    url: start.href, finalUrl: page.finalUrl, domain: domainOf(final), reachable, title, description,
    iconUrl: iconRaw, ogImage, themeColor, manifestUrl, screenshots, host, hostSignal: signal,
    isPwa: manifestOk, isInstallable: installable,
    checks: {
      reachable, https_ok: https && !page.redirectedToHttp, responsive,
      mobile_optimized: responsive && Boolean(themeColor || appleIcon || manifestOk),
      manifest_ok: manifestOk, service_worker_ok: serviceWorker, installable,
      offline_support: null, push_support: null,
      security_ok: https && !page.redirectedToHttp && reachable,
      status_code: page.status, response_ms: page.ms,
    },
    notes,
  }
}
