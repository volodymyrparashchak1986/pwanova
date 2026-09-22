/** Pure SVG builders for the plain-image partner badge (/api/badge/[slug]). Kept separate from the
 *  route handler so the XML-escaping can be unit tested without a Next.js request context. */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

export interface BadgeInput { title: string; subtitle: string; verified: boolean; demo: boolean; dark: boolean }

export function badgeSvg({ title, subtitle, verified, demo, dark }: BadgeInput): string {
  const bg = dark ? "#14141c" : "#ffffff"
  const fg = dark ? "#f4f4f8" : "#171720"
  const sub = dark ? "#9a9aab" : "#6b6b7a"
  const star = "#e0a935"
  const brand1 = "#6a4df5"
  const brand2 = "#3fb6d8"
  const label = `${title}${subtitle ? `, ${subtitle}` : ""} on PWANova${demo ? " (demo data)" : ""}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="60" viewBox="0 0 220 60" role="img" aria-label="${esc(label)}">
  <title>${esc(label)}</title>
  <rect width="220" height="60" rx="12" fill="${bg}" stroke="${dark ? "#2a2a38" : "#e6e6ec"}"/>
  <rect x="10" y="10" width="40" height="40" rx="10" fill="url(#pwn-g)"/>
  <path d="M30 18c1 5.4 3.3 7.8 8.6 8.8-5.3.9-7.6 3.3-8.6 8.7-1-5.4-3.3-7.8-8.6-8.7 5.3-1 7.6-3.4 8.6-8.8Z" fill="#fff"/>
  <text x="58" y="27" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="14" font-weight="700" fill="${fg}">${esc(title)}${verified ? " ✓" : ""}</text>
  <text x="58" y="43" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="11" fill="${sub}">${esc(subtitle)}${demo ? " · demo" : ""}</text>
  <defs><linearGradient id="pwn-g" x1="0" y1="0" x2="40" y2="40"><stop stop-color="${brand1}"/><stop offset="1" stop-color="${brand2}"/></linearGradient></defs>
  ${verified ? `<circle cx="204" cy="16" r="6" fill="${star}"/>` : ""}
</svg>`
}

export function badgeNotFoundSvg(dark: boolean): string {
  const bg = dark ? "#14141c" : "#ffffff"
  const fg = dark ? "#9a9aab" : "#6b6b7a"
  return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="60" viewBox="0 0 220 60" role="img" aria-label="Not listed on PWANova">
  <rect width="220" height="60" rx="12" fill="${bg}" stroke="${dark ? "#2a2a38" : "#e6e6ec"}"/>
  <text x="16" y="34" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="12" fill="${fg}">Not listed on PWANova</text>
</svg>`
}
