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
