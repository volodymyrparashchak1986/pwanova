/** Shareable comparison URLs: /compare/a-vs-b. One canonical order, at most four apps. */
export const MAX_COMPARE = 4
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Deduplicated, alphabetical, capped at four. The canonical key is the same whatever order apps were added in. */
export function comparisonSlugs(slugs: string[]): string[] {
  return [...new Set(slugs.map((s) => s.trim().toLowerCase()).filter((s) => SLUG.test(s)))].sort().slice(0, MAX_COMPARE)
}

export function comparisonKey(slugs: string[]): string {
  return comparisonSlugs(slugs).join("-vs-")
}

/** The parts of a key. More parts than any comparison can have are not looked at. */
const keyParts = (key: string) => key.toLowerCase().split("-vs-").filter((p) => SLUG.test(p)).slice(0, MAX_COMPARE * 2)

/**
 * Every slug a key could name: its parts, and every run of neighbouring parts joined by "-vs-",
 * because a slug may itself contain "-vs-". Single parts come first. At most 36 candidates.
 */
export function comparisonCandidates(key: string): string[] {
  const parts = keyParts(key)
  const out = [...parts]
  for (let length = 2; length <= parts.length; length++) {
    for (let i = 0; i + length <= parts.length; i++) out.push(parts.slice(i, i + length).join("-vs-"))
  }
  return [...new Set(out)]
}

/**
 * Splits a key back into slugs. A slug may itself contain "-vs-", so when the known slugs are given
 * the longest matching slug wins; without them the key is split on every "-vs-".
 */
export function parseComparisonKey(key: string, known?: Set<string>): string[] {
  const parts = keyParts(key)
  if (!known) return parts
  const out: string[] = []
  for (let i = 0; i < parts.length;) {
    let matched = false
    for (let j = parts.length; j > i; j--) {
      const candidate = parts.slice(i, j).join("-vs-")
      if (known.has(candidate)) { out.push(candidate); i = j; matched = true; break }
    }
    if (!matched) { out.push(parts[i]); i++ }
  }
  return out
}

/** True when the key in the URL is exactly the canonical one for its apps. */
export const isCanonicalKey = (key: string, slugs: string[]) => key === comparisonKey(slugs)

/** Two listed apps make an indexable page; three or four are useful but would multiply thin URLs. */
export const isIndexableComparison = (slugs: string[]) => slugs.length === 2
