import type { TrafficSource } from "./constants"

const SOCIAL = ["twitter.com", "x.com", "t.co", "facebook.com", "linkedin.com", "lnkd.in", "reddit.com", "instagram.com", "threads.net", "bsky.app", "news.ycombinator.com"]

/**
 * Classifies where a visit came from. Precedence:
 * partner attribution cookie > internal `from` marker > referrer host.
 * (launch_source, traffic_source and referral_partner are three different things.)
 */
export function classifyTraffic(input: { from?: string | null; referrer?: string | null; hasPartner: boolean; siteHost: string }): TrafficSource {
  if (input.hasPartner) return "partner"
  if (input.from === "search") return "pwanova_search"
  if (input.from === "home") return "homepage"
  if (!input.referrer) return "direct"
  let host = ""
  try { host = new URL(input.referrer).hostname.toLowerCase().replace(/^www\./, "") } catch { return "direct" }
  if (host === input.siteHost.replace(/^www\./, "")) return "other"
  if (host.includes("google.")) return "google"
  if (host.endsWith("producthunt.com")) return "product_hunt"
  if (SOCIAL.some((s) => host === s || host.endsWith(`.${s}`))) return "social"
  return "other"
}
