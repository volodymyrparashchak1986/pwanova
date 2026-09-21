export const formatRating = (n: number) => (n > 0 ? n.toFixed(1) : "–")
export const formatCount = (n: number) => new Intl.NumberFormat("en", { notation: n >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n)
export const plural = (n: number, one: string, many = `${one}s`) => `${formatCount(n)} ${n === 1 ? one : many}`

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never"
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return "just now"
  const units: [number, string][] = [[60, "m"], [3600, "h"], [86400, "d"], [86400 * 30, "mo"], [86400 * 365, "y"]]
  let out = `${Math.floor(s / 60)}m`
  for (const [size, label] of units) if (s >= size) out = `${Math.floor(s / size)}${label}`
  return `${out} ago`
}

export function hueFor(seed: string) {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}
