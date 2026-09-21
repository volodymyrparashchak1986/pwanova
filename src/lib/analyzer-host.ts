import type { HostProvider } from "@/lib/constants"

export function detectHost(url: URL, headers: Headers): { host: HostProvider; signal: string | null } {
  const h = url.hostname.toLowerCase()
  if (h.endsWith(".vercel.app")) return { host: "vercel", signal: "*.vercel.app domain" }
  if (h.endsWith(".netlify.app")) return { host: "netlify", signal: "*.netlify.app domain" }
  if (h.endsWith(".pages.dev") || h.endsWith(".workers.dev")) return { host: "cloudflare", signal: "Cloudflare domain" }
  if (h.endsWith(".web.app") || h.endsWith(".firebaseapp.com")) return { host: "firebase", signal: "Firebase domain" }
  if (h.endsWith(".up.railway.app") || h.endsWith(".railway.app")) return { host: "railway", signal: "Railway domain" }
  if (h.endsWith(".onrender.com")) return { host: "render", signal: "Render domain" }
  const server = (headers.get("server") ?? "").toLowerCase()
  if (headers.get("x-vercel-id") || server === "vercel") return { host: "vercel", signal: "Vercel response headers (custom domain)" }
  if (headers.get("x-nf-request-id") || server === "netlify") return { host: "netlify", signal: "Netlify response headers (custom domain)" }
  if (headers.get("x-render-origin-server") || headers.get("rndr-id")) return { host: "render", signal: "Render response headers (custom domain)" }
  if (server.includes("railway")) return { host: "railway", signal: "Railway response headers (custom domain)" }
  if (headers.get("x-firebase-hosting") || headers.get("x-served-by")?.includes("firebase")) return { host: "firebase", signal: "Firebase headers (custom domain)" }
  if (headers.get("cf-ray") || server === "cloudflare") return { host: "cloudflare", signal: "Cloudflare headers (may be CDN only)" }
  return { host: "custom-domain", signal: null }
}
