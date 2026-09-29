/**
 * Link discovery: which documents does a start page point to? Pure functions, no network.
 * A page is parsed as text; nothing in it is executed.
 */

export type DocKind =
  | "privacy_policy" | "legal_notice" | "terms_of_service" | "dpa_available" | "subprocessors_published"
  | "pricing_page" | "api_docs" | "changelog" | "contact_available" | "source_repository" | "mcp_available" | "ai_transparency_info"

export interface PageLink { href: string; text: string; rel: string }
export interface Candidate { kind: DocKind; url: string; text: string; score: number }

interface Rule {
  kind: DocKind
  /** matched against the visible text of a short link */
  text: RegExp
  /** matched against the last part of the address, without its extension: /legal/privacy-policy.html → "privacy-policy" */
  segment: RegExp
  /** words the target page must contain to count as found */
  confirm: RegExp | null
  sameSite: boolean
}

// English and German wording. Order matters where patterns overlap: the DPA rule runs before privacy.
// An address counts by its last part only, so /blog/our-privacy-story is a blog post and not a policy.
export const RULES: Rule[] = [
  { kind: "dpa_available", text: /\b(dpa|data processing (agreement|addendum)|auftragsverarbeitung|av-vertrag|avv)\b/i, segment: /^(dpa|data-processing(-agreement|-addendum)?|auftragsverarbeitung(svertrag)?|avv|av-vertrag)$/, confirm: /data processing|auftragsverarbeitung|processor|auftragsverarbeiter/i, sameSite: false },
  { kind: "subprocessors_published", text: /\b(sub-?processors?|unterauftragsverarbeiter|subunternehmer)\b/i, segment: /^(sub-?processors?|unterauftragsverarbeiter|subunternehmer)$/, confirm: /sub-?processor|unterauftragsverarbeiter/i, sameSite: false },
  { kind: "privacy_policy", text: /\b(privacy|datenschutz|data protection)\b/i, segment: /^(privacy(-policy|-notice|-statement)?|datenschutz(erklaerung|erklärung|hinweise)?|data-protection)$/, confirm: /privacy|datenschutz|personal data|personenbezogene/i, sameSite: false },
  { kind: "legal_notice", text: /\b(impressum|imprint|legal notice|legal disclosure|anbieterkennzeichnung)\b/i, segment: /^(impressum|imprint|legal-notice|legal-disclosure)$/, confirm: /impressum|imprint|legal notice|angaben gem|responsible for content|verantwortlich/i, sameSite: false },
  { kind: "terms_of_service", text: /\b(terms( of (service|use))?|terms & conditions|agb|nutzungsbedingungen|allgemeine geschäftsbedingungen)\b/i, segment: /^(terms(-of-(service|use)|-and-conditions|-conditions)?|tos|agb|nutzungsbedingungen)$/, confirm: /terms|agb|nutzungsbedingungen|geschäftsbedingungen/i, sameSite: false },
  { kind: "pricing_page", text: /^\s*(pricing|preise|plans|tarife|plans? (&|and) pricing)\s*$/i, segment: /^(pricing|preise|plans|tarife)$/, confirm: /pricing|price|preis|plan|€|\$|per month|pro monat|free/i, sameSite: true },
  { kind: "mcp_available", text: /\b(mcp( server)?|model context protocol)\b/i, segment: /^(mcp(-server)?|model-context-protocol)$/, confirm: /model context protocol|mcp server/i, sameSite: false },
  { kind: "api_docs", text: /\b(api( (docs|reference|documentation))?|developer (docs|documentation)|rest api|graphql api)\b/i, segment: /^(api|api-docs|api-reference|api-documentation|developers?)$/, confirm: /\bapi\b|endpoint|authentication|rest|graphql/i, sameSite: false },
  { kind: "changelog", text: /\b(changelog|release notes|what'?s new|releases|neuigkeiten)\b/i, segment: /^(changelog|release-notes|releases|whats-new)$/, confirm: /changelog|release|version|added|fixed|neu/i, sameSite: false },
  { kind: "ai_transparency_info", text: /\b(ai (transparency|policy|principles)|how we use ai|ki-transparenz|ki-richtlinie)\b/i, segment: /^(ai-(transparency|policy|principles)|ki-transparenz)$/, confirm: /\b(ai|ki|artificial intelligence|künstliche intelligenz|model)\b/i, sameSite: false },
  { kind: "contact_available", text: /^\s*(contact( us)?|kontakt|get in touch)\s*$/i, segment: /^(contact(-us)?|kontakt)$/, confirm: null, sameSite: false },
]

/** The last part of an address in lower case, without a file extension. */
export const lastSegment = (pathname: string): string => {
  const parts = pathname.split("/").filter(Boolean)
  let last = parts.at(-1) ?? ""
  try { last = decodeURIComponent(last) } catch { /* kept as it is */ }
  return last.toLowerCase().replace(/\.(html?|php|aspx?|pdf|md|txt)$/, "")
}

/** A link text longer than this is a sentence that mentions a word, not the name of a document. */
const MAX_LINK_TEXT = 60

const REPO_HOSTS = ["github.com", "gitlab.com", "codeberg.org", "bitbucket.org"]
const REPO_SKIP = new Set(["features", "pricing", "about", "login", "join", "explore", "marketplace", "sponsors", "topics", "orgs", "settings", "site", "contact", "security", "enterprise", "customer-stories", "readme", "collections", "trending"])

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
const attr = (tag: string, name: string): string | null => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))
  return m ? decode((m[1] ?? m[2] ?? m[3] ?? "").trim()) : null
}
const stripTags = (html: string) => decode(html.replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()

/** Every <a href> of a page with its visible text (or aria-label / title when the link is an icon). */
export function extractLinks(html: string, max = 600): PageLink[] {
  const out: PageLink[] = []
  const body = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, " ")
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) && out.length < max) {
    const tag = `<a ${m[1]}>`
    const href = attr(tag, "href")
    if (!href || href.startsWith("#") || /^(javascript|data|vbscript):/i.test(href)) continue
    const text = stripTags(m[2]) || attr(tag, "aria-label") || attr(tag, "title") || ""
    out.push({ href, text: text.slice(0, 120), rel: (attr(tag, "rel") ?? "").toLowerCase() })
  }
  return out
}

/** Absolute http(s) URL of a link, or null. Fragments are dropped: they do not identify a document. */
export function resolveLink(href: string, base: string): URL | null {
  try {
    const u = new URL(href, base)
    if (u.protocol !== "https:" && u.protocol !== "http:") return null
    if (u.username || u.password) return null
    u.hash = ""
    return u
  } catch { return null }
}

const registrable = (host: string) => host.toLowerCase().replace(/^www\./, "").split(".").slice(-2).join(".")
export const sameSite = (a: URL, b: URL) => registrable(a.hostname) === registrable(b.hostname)

function repoUrl(u: URL): string | null {
  const host = u.hostname.toLowerCase().replace(/^www\./, "")
  if (!REPO_HOSTS.includes(host)) return null
  const [owner, repo] = u.pathname.split("/").filter(Boolean)
  if (!owner || !repo || REPO_SKIP.has(owner.toLowerCase())) return null
  if (!/^[\w.-]{1,100}$/.test(owner) || !/^[\w.-]{1,100}$/.test(repo)) return null
  return `https://${host}/${owner}/${repo.replace(/\.git$/, "")}`
}

/**
 * The best candidate per document kind. Link text and URL path both count; a match in both wins.
 * Links in the page are candidates only: a document counts as found after its own page was fetched.
 */
export function discoverLinks(html: string, pageUrl: string): Map<DocKind, Candidate> {
  const page = new URL(pageUrl)
  const best = new Map<DocKind, Candidate>()
  const offer = (c: Candidate) => { const cur = best.get(c.kind); if (!cur || c.score > cur.score) best.set(c.kind, c) }

  for (const link of extractLinks(html)) {
    if (/^mailto:/i.test(link.href)) {
      offer({ kind: "contact_available", url: pageUrl, text: "mailto", score: 1 })
      continue
    }
    const url = resolveLink(link.href, pageUrl)
    if (!url) continue
    const repo = repoUrl(url)
    if (repo) {
      // a repository that carries the product's own name is a stronger candidate than any other repository link
      const name = registrable(page.hostname).split(".")[0]
      const own = name.length > 2 && repo.toLowerCase().includes(name)
      offer({ kind: "source_repository", url: repo, text: link.text, score: own ? 3 : 1 })
      continue
    }
    for (const rule of RULES) {
      const byText = link.text.length <= MAX_LINK_TEXT && rule.text.test(link.text)
      const byPath = rule.segment.test(lastSegment(url.pathname))
      if (!byText && !byPath) continue
      if (rule.sameSite && !sameSite(url, page)) continue
      const score = (byText ? 2 : 0) + (byPath ? 2 : 0) + (sameSite(url, page) ? 1 : 0)
      offer({ kind: rule.kind, url: url.href, text: link.text, score })
      break // one link is one kind of document
    }
  }
  return best
}

/** A short quote from the fetched document around the first confirming word, for the evidence record. */
export function confirmingExcerpt(html: string, confirm: RegExp, max = 220): string | null {
  const text = stripTags(html)
  const m = confirm.exec(text)
  if (!m) return null
  const start = Math.max(0, m.index - 60)
  const cut = text.slice(start, start + max).trim()
  return `${start > 0 ? "…" : ""}${cut}${start + max < text.length ? "…" : ""}`
}

export function pageTitle(html: string): string | null {
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  return t ? decode(t).replace(/\s+/g, " ").trim().slice(0, 200) || null : null
}

/** Languages a page declares: <html lang> and hreflang alternates. */
export function declaredLanguages(html: string): string[] {
  const out = new Set<string>()
  const lang = html.match(/<html\b[^>]*\slang\s*=\s*["']?([a-zA-Z-]{2,10})/i)?.[1]
  if (lang) out.add(lang.toLowerCase().split("-")[0])
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/rel\s*=\s*["']?alternate/i.test(tag)) continue
    const h = attr(tag, "hreflang")
    if (h && h.toLowerCase() !== "x-default") out.add(h.toLowerCase().split("-")[0])
  }
  return [...out].filter((l) => /^[a-z]{2,3}$/.test(l))
}

/** Minimal robots.txt reader: the Disallow rules that apply to PWANovaBot (or to every agent). */
export function disallowedPaths(robots: string, agent = "pwanovabot"): string[] {
  const groups: { agents: string[]; rules: string[] }[] = []
  let current: { agents: string[]; rules: string[] } | null = null
  let lastWasAgent = false
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim()
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i)
    if (!m) continue
    const key = m[1].toLowerCase(), value = m[2].trim()
    if (key === "user-agent") {
      if (!current || !lastWasAgent) { current = { agents: [], rules: [] }; groups.push(current) }
      current.agents.push(value.toLowerCase())
      lastWasAgent = true
    } else {
      lastWasAgent = false
      if (key === "disallow" && current && value) current.rules.push(value)
    }
  }
  const own = groups.filter((g) => g.agents.some((a) => a !== "*" && agent.includes(a)))
  return (own.length ? own : groups.filter((g) => g.agents.includes("*"))).flatMap((g) => g.rules)
}

export function isAllowed(url: string, disallowed: string[]): boolean {
  let path: string
  try { const u = new URL(url); path = u.pathname + u.search } catch { return false }
  return !disallowed.some((rule) => {
    const pattern = rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$")
    try { return new RegExp(`^${pattern}`).test(path) } catch { return path.startsWith(rule) }
  })
}
