/**
 * Mirrors public.ranking_score / public.trending_score in supabase/migrations/*_views.sql.
 * Keep both in sync. Used by demo mode and for tests.
 */
export function rankingScore(i: {
  rating: number
  ratingsCount: number
  reviewsCount: number
  favoritesCount: number
  opens30d: number
  opens7d: number
  qualityPassed: number
}) {
  const m = 10 // prior weight
  const prior = 3.8
  const bayes = ((i.ratingsCount / (i.ratingsCount + m)) * i.rating + (m / (i.ratingsCount + m)) * prior) / 5
  return (
    bayes * 60 +
    Math.min(10, Math.log(1 + i.reviewsCount) * 3) +
    Math.min(8, Math.log(1 + i.favoritesCount) * 2) +
    Math.min(10, Math.log(1 + i.opens30d) * 1.6) +
    Math.min(4, Math.log(1 + i.opens7d)) +
    Math.min(8, i.qualityPassed * 1.2)
  )
}

export function trendingScore(i: { opens7d: number; favorites7d: number; reviews7d: number; ratings7d: number }) {
  return i.opens7d + i.favorites7d * 4 + i.reviews7d * 5 + i.ratings7d * 3
}
