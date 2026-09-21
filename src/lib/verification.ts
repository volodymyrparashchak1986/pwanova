import "server-only"
import { resolveTxt } from "node:dns/promises"
import { safeFetch } from "@/lib/security/ssrf"

export type ClaimMethod = "meta_tag" | "well_known" | "dns_txt"

export const claimInstructions = (token: string, domain: string) => ({
  meta_tag: { title: "HTML meta tag", snippet: `<meta name="pwanova-verification" content="${token}">`, where: "Add inside <head> of your home page." },
  well_known: { title: "Well-known file", snippet: token, where: `Serve at https://${domain}/.well-known/pwanova-verification.txt (file content is the token only).` },
  dns_txt: { title: "DNS TXT record", snippet: `pwanova-verification=${token}`, where: `Add a TXT record on _pwanova.${domain}.` },
})

/** Proves control of the domain by looking for the claim token. All fetching is SSRF-guarded. */
export async function verifyOwnership(appUrl: string, domain: string, token: string, method: ClaimMethod): Promise<{ ok: boolean; error?: string }> {
  try {
    if (method === "meta_tag") {
      const res = await safeFetch(appUrl, { maxBytes: 600_000 })
      const found = new RegExp(`<meta[^>]+name=["']pwanova-verification["'][^>]*content=["']${token}["']|<meta[^>]+content=["']${token}["'][^>]*name=["']pwanova-verification["']`, "i").test(res.body)
      return found ? { ok: true } : { ok: false, error: "Meta tag not found on your home page yet. Deploy the change and try again." }
    }
    if (method === "well_known") {
      const res = await safeFetch(new URL("/.well-known/pwanova-verification.txt", appUrl), { maxBytes: 2_000, accept: "text/plain" })
      return res.status === 200 && res.body.trim() === token ? { ok: true } : { ok: false, error: "Verification file not found or its content does not match." }
    }
    const records = (await resolveTxt(`_pwanova.${domain}`)).map((r) => r.join(""))
    return records.includes(`pwanova-verification=${token}`) ? { ok: true } : { ok: false, error: "TXT record not found yet. DNS changes can take a while to propagate." }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Verification failed." }
  }
}
