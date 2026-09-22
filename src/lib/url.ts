/** Shared (client + server) syntactic URL validation. DNS-level checks live in security/ssrf.ts. */
export class UrlError extends Error {}

const BLOCKED_HOST_SUFFIXES = [".local", ".localhost", ".internal", ".intranet", ".lan", ".home", ".corp", ".test", ".invalid", ".onion"]

export function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "")
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIp(mapped[1])
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v)) {
    const [a, b] = v.split(".").map(Number)
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0)
    )
  }
  if (v.includes(":")) {
    // Only globally routed IPv6 unicast. Reject mapped/translated IPv4,
    // loopback, ULA, link-local, multicast, transition and documentation ranges.
    let normalized: string
    try { normalized = new URL(`http://[${v}]/`).hostname.slice(1, -1) } catch { return true }
    return !/^[23][0-9a-f]{3}:/.test(normalized) ||
      /^2001:(?:0:|db8:|[12][0-9a-f]:)/.test(normalized) || /^2002:/.test(normalized)
  }
  return false
}

/** Accepts only public-looking http(s) URLs. Throws UrlError otherwise. */
export function parsePublicUrl(input: string): URL {
  const raw = input.trim()
  if (!raw || raw.length > 2048) throw new UrlError("Enter a valid URL.")
  const withProto = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
  let url: URL
  try { url = new URL(withProto) } catch { throw new UrlError("Enter a valid URL.") }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new UrlError("Only http(s) URLs are allowed.")
  if (url.username || url.password) throw new UrlError("URLs with credentials are not allowed.")
  const host = url.hostname.toLowerCase()
  if (host === "localhost" || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) throw new UrlError("Local and internal addresses are not allowed.")
  if (isPrivateIp(host)) throw new UrlError("Private IP addresses are not allowed.")
  if (!host.includes(".") && !host.includes(":")) throw new UrlError("Enter a fully qualified domain.")
  if (url.port) throw new UrlError("Only default ports are allowed.")
  url.hash = ""
  return url
}

export function domainOf(url: string | URL): string {
  const u = typeof url === "string" ? new URL(url) : url
  return u.hostname.toLowerCase().replace(/^www\./, "")
}

export function slugify(input: string): string {
  return input.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "app"
}

export function canonicalAppUrl(input: string): string {
  const url = parsePublicUrl(input)
  return url.origin + (url.pathname.replace(/\/+$/, "") || "/")
}
