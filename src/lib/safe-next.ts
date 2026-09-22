/** Same-origin paths only, including after browser URL normalization. */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || /[\\\u0000-\u0020]/.test(next)) return fallback
  try {
    const decoded = decodeURIComponent(next)
    if (decoded.startsWith("//") || /[\\\u0000-\u001f]/.test(decoded)) return fallback
    const parsed = new URL(next, "https://pwanova.invalid")
    if (parsed.origin !== "https://pwanova.invalid") return fallback
    return parsed.pathname + parsed.search + parsed.hash
  } catch { return fallback }
}
