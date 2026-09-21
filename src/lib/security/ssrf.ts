import "server-only"
import dns from "node:dns"
import { Agent, fetch as undiciFetch } from "undici"
import { isPrivateIp, parsePublicUrl, UrlError } from "@/lib/url"

type LookupCb = (err: Error | null, address?: string | dns.LookupAddress[], family?: number) => void

/**
 * Every socket the fetcher opens resolves DNS through this lookup and refuses
 * private / loopback / link-local answers. Validating inside the connection
 * (not before it) means DNS rebinding cannot swap the IP after the check.
 */
const agent = new Agent({
  connect: {
    lookup(hostname: string, options: { all?: boolean }, callback: LookupCb) {
      dns.lookup(hostname, { all: true }, (err, addresses) => {
        if (err) return callback(err)
        if (!addresses.length || addresses.some((a) => isPrivateIp(a.address))) {
          return callback(new UrlError("Host resolves to a private address."))
        }
        if (options?.all) return callback(null, addresses)
        return callback(null, addresses[0].address, addresses[0].family)
      })
    },
  } as never,
})

export interface SafeResponse {
  finalUrl: string
  status: number
  headers: Headers
  body: string
  ms: number
  redirectedToHttp: boolean
}

/** Server-side fetch of an untrusted URL: public hosts only, manual redirects (each hop revalidated), size + time caps. */
export async function safeFetch(
  input: string | URL,
  opts: { timeoutMs?: number; maxBytes?: number; maxRedirects?: number; accept?: string } = {},
): Promise<SafeResponse> {
  const { timeoutMs = 8000, maxBytes = 1_500_000, maxRedirects = 4, accept = "text/html,application/json;q=0.9,*/*;q=0.5" } = opts
  let url = parsePublicUrl(String(input))
  const startedHttps = url.protocol === "https:"
  const started = Date.now()
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await undiciFetch(url, {
      dispatcher: agent,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "PWANovaBot/1.0 (+https://pwanova.app)", accept },
    })
    const location = res.headers.get("location")
    if (res.status >= 300 && res.status < 400 && location) {
      url = parsePublicUrl(new URL(location, url).href)
      await res.body?.cancel()
      continue
    }
    const reader = res.body?.getReader()
    const chunks: Uint8Array[] = []
    let received = 0
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > maxBytes) { await reader.cancel(); break }
      chunks.push(value)
    }
    return {
      finalUrl: url.href,
      status: res.status,
      headers: res.headers as unknown as Headers,
      body: Buffer.concat(chunks).toString("utf8"),
      ms: Date.now() - started,
      redirectedToHttp: startedHttps && url.protocol === "http:",
    }
  }
  throw new UrlError("Too many redirects.")
}
