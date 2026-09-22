import "server-only"
import { safeFetch } from "@/lib/security/ssrf"
import { wellKnownMatches } from "@/lib/verification-utils"

export type ClaimMethod = "meta_tag" | "well_known" | "dns_txt"

export const claimInstructions = (token: string, appUrl: string) => {
  const origin = new URL(appUrl).origin
  const domain = new URL(appUrl).hostname
  return ({
  meta_tag: { title: "HTML meta tag", snippet: `<meta name="pwanova-verification" content="${token}">`, where: "Add inside <head> of your home page." },
  well_known: { title: "Well-known file", snippet: token, where: `Serve at ${origin}/.well-known/pwanova-verification.txt (file content is the token only).` },
  dns_txt: { title: "DNS TXT record", snippet: `pwanova-verification=${token}`, where: `Add a TXT record on _pwanova.${domain}.` },
})
}

/** Proves control of the domain by looking for the claim token. All fetching is SSRF-guarded. */
export async function verifyOwnership(appUrl: string, _domain: string, token: string, method: ClaimMethod): Promise<{ ok: boolean; error?: string }> {
  try {
    if (new URL(appUrl).protocol !== "https:") return { ok: false, error: "Ownership verification requires an HTTPS app URL." }
    if (method !== "well_known") return { ok: false, error: "This method is not available in the beta." }
    if (method === "well_known") {
      const res = await safeFetch(new URL("/.well-known/pwanova-verification.txt", appUrl), { maxBytes: 2_000, maxRedirects: 0, accept: "text/plain" })
      return res.status === 200 && wellKnownMatches(res.body, token) ? { ok: true } : { ok: false, error: "Verification file not found or its content does not match." }
    }
    return { ok: false, error: "Unsupported method." }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Verification failed." }
  }
}
