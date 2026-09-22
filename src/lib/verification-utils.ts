/** Pure helpers for ownership verification (kept separate from the server-only fetching so they can be unit tested). */

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * True when the page <head> contains <meta name="pwanova-verification" content="TOKEN"> (either attribute order).
 * Comments and anything after </head> are ignored, so user-generated content in the body cannot claim a site.
 */
export function hasMetaToken(html: string, token: string): boolean {
  const head = html.replace(/<!--[\s\S]*?-->/g, "").split(/<\/head\s*>/i)[0]
  const t = esc(token)
  return (
    new RegExp(`<meta[^>]+name=["']pwanova-verification["'][^>]*content=["']${t}["']`, "i").test(head) ||
    new RegExp(`<meta[^>]+content=["']${t}["'][^>]*name=["']pwanova-verification["']`, "i").test(head)
  )
}

/** The well-known file must contain exactly the token (surrounding whitespace ignored). */
export const wellKnownMatches = (body: string, token: string) => body.trim() === token

/** TXT records are joined per record; the expected value is `pwanova-verification=TOKEN`. */
export const txtRecordMatches = (records: string[][], token: string) => records.some((r) => r.join("") === `pwanova-verification=${token}`)

/** A claim token is only valid while fresh; an expired one must not be accepted even if it still matches. */
export const isClaimExpired = (expiresAtIso: string, now: Date | number = Date.now()) => new Date(expiresAtIso).getTime() <= new Date(now).valueOf()

/** Fresh, unguessable, URL-safe token for a new (or restarted) ownership claim. Not derived from any secret. */
export const generateClaimToken = () => crypto.randomUUID().replace(/-/g, "")

export const CLAIM_TTL_MS = 3 * 24 * 60 * 60 * 1000 // 3 days, mirrors app_claims.expires_at's default in the schema
