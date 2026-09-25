/** Pure selection logic for review highlights (unit-tested; no data access here). */

export interface HighlightCandidate {
  id: string
  appId: string
  helpfulCount: number
  createdAt: string
  body: string
}

/** Most helpful first, then newest; ties are stable. */
export function byHelpfulThenNewest<T extends Pick<HighlightCandidate, "helpfulCount" | "createdAt">>(a: T, b: T): number {
  return b.helpfulCount - a.helpfulCount || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

/**
 * Up to `perApp` reviews for each app in `appIds`, most helpful first. Reviews of apps outside the
 * list and reviews with an empty body are dropped. The result keeps the caller's app order so a
 * "top three" list stays in rank order on screen.
 */
export function pickReviewHighlights<T extends HighlightCandidate>(reviews: T[], appIds: string[], perApp = 3): Map<string, T[]> {
  const cap = Math.max(0, Math.floor(perApp))
  const wanted = new Set(appIds)
  const out = new Map<string, T[]>(appIds.map((id) => [id, []]))
  for (const r of [...reviews].sort(byHelpfulThenNewest)) {
    if (!wanted.has(r.appId) || !r.body.trim()) continue
    const bucket = out.get(r.appId)!
    if (bucket.length < cap) bucket.push(r)
  }
  return out
}
