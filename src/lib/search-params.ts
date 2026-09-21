import type { AppFilters } from "./types"

type SP = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export function filtersFromParams(sp: SP): AppFilters {
  const sort = one(sp.sort)
  const rating = Number(one(sp.rating))
  return {
    q: one(sp.q)?.slice(0, 80) || undefined,
    category: one(sp.category) || undefined,
    minRating: rating > 0 && rating <= 5 ? rating : undefined,
    verified: one(sp.verified) === "1",
    installable: one(sp.installable) === "1",
    pwa: one(sp.pwa) === "1",
    build: one(sp.build) || undefined,
    host: one(sp.host) || undefined,
    launch: one(sp.launch) || undefined,
    sort: sort === "trending" || sort === "new" || sort === "rating" || sort === "top" ? sort : undefined,
  }
}
