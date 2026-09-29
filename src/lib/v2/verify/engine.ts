import "server-only"
import { safeFetch, type SafeResponse } from "@/lib/security/ssrf"
import { createAdminClient } from "@/lib/supabase/admin"
import { asJson, nullable } from "@/lib/supabase/rpc"
import { confirmingExcerpt, declaredLanguages, disallowedPaths, discoverLinks, isAllowed, pageTitle, RULES, type DocKind } from "./links"

/** One line of a verification run, in the shape record_verification_run() reads. */
export interface CheckResult {
  check_key: string
  attribute_key: string | null
  outcome: "found" | "not_found" | "could_not_check" | "skipped"
  value_state?: "yes" | "no"
  value_text?: string | null
  source_url?: string | null
  source_title?: string | null
  excerpt?: string | null
  http_status?: number | null
  confidence?: number
  detail?: Record<string, unknown>
}

export interface VerificationReport { results: CheckResult[]; error: string | null; finalUrl: string | null; fetched: number }

const DOC_ATTRIBUTE: Record<DocKind, string> = {
  privacy_policy: "privacy_policy", legal_notice: "legal_notice", terms_of_service: "terms_of_service", dpa_available: "dpa_available",
  subprocessors_published: "subprocessors_published", pricing_page: "pricing_page", api_docs: "api_docs", changelog: "changelog",
  contact_available: "contact_available", source_repository: "source_repository", mcp_available: "mcp_available", ai_transparency_info: "ai_transparency_info",
}
/** Every document the engine looks for, so a run always reports on the same list. */
const DOC_KINDS = Object.keys(DOC_ATTRIBUTE) as DocKind[]
const MAX_DOCUMENT_FETCHES = 12

type Fetcher = (url: string, opts?: { timeoutMs?: number; maxBytes?: number; maxRedirects?: number; accept?: string }) => Promise<SafeResponse>

const isHtml = (r: SafeResponse) => /html|xml|text\/plain/i.test(r.headers.get("content-type") ?? "text/html")
const isPdf = (r: SafeResponse) => /application\/pdf/i.test(r.headers.get("content-type") ?? "")
const message = (e: unknown) => (e instanceof Error ? e.message : "Request failed").slice(0, 200)

/**
 * Looks at a product's public website and reports what it found. Rules it never breaks:
 *  - every request goes through the SSRF-guarded fetcher (public hosts only, redirects re-validated, size and time caps);
 *  - a document counts as found only after its own page was fetched and reads like that document;
 *  - "no link on the start page" is reported as not found WITHOUT an answer: it never becomes a "no";
 *  - anything that could not be fetched is "could not check", which leaves earlier results untouched.
 */
export async function inspectWebsite(appUrl: string, fetcher: Fetcher = safeFetch, deadlineMs = 25_000): Promise<VerificationReport> {
  const started = Date.now()
  const left = () => Math.max(1500, Math.min(8000, deadlineMs - (Date.now() - started)))
  const expired = () => Date.now() - started > deadlineMs
  const results: CheckResult[] = []
  let fetched = 0

  let page: SafeResponse
  try {
    page = await fetcher(appUrl, { timeoutMs: left() })
    fetched++
  } catch (e) {
    // Nothing could be looked at: every automatic check is "could not check", no answer changes.
    for (const key of ["website_reachable", "https", "pwa_manifest", ...DOC_KINDS.map((k) => DOC_ATTRIBUTE[k]), "security_txt", "german_available"]) {
      results.push({ check_key: key, attribute_key: key, outcome: "could_not_check", detail: { error: message(e) } })
    }
    return { results, error: message(e), finalUrl: null, fetched }
  }

  const final = new URL(page.finalUrl)
  const origin = final.origin
  const html = isHtml(page) ? page.body : ""
  const reachable = page.status >= 200 && page.status < 400
  const title = pageTitle(html) ?? "Start page"

  if (page.status >= 500) {
    results.push({ check_key: "website_reachable", attribute_key: "website_reachable", outcome: "could_not_check", http_status: page.status, source_url: page.finalUrl })
  } else {
    results.push({ check_key: "website_reachable", attribute_key: "website_reachable", outcome: reachable ? "found" : "not_found", value_state: reachable ? "yes" : "no", source_url: page.finalUrl, source_title: title, http_status: page.status, confidence: 100 })
  }
  const https = final.protocol === "https:" && !page.redirectedToHttp
  results.push({ check_key: "https", attribute_key: "https", outcome: https ? "found" : "not_found", value_state: https ? "yes" : "no", source_url: page.finalUrl, source_title: title, http_status: page.status, confidence: 100 })

  if (!reachable || !html) {
    for (const kind of DOC_KINDS) results.push({ check_key: kind, attribute_key: DOC_ATTRIBUTE[kind], outcome: "could_not_check", http_status: page.status, source_url: page.finalUrl })
    for (const key of ["pwa_manifest", "security_txt", "german_available"]) results.push({ check_key: key, attribute_key: key, outcome: "could_not_check", http_status: page.status })
    return { results, error: `Start page answered with HTTP ${page.status}`, finalUrl: page.finalUrl, fetched }
  }

  // robots.txt: PWANovaBot does not open pages the site asks robots to stay away from
  let disallowed: string[] = []
  try {
    const robots = await fetcher(`${origin}/robots.txt`, { timeoutMs: left(), maxBytes: 100_000, maxRedirects: 2, accept: "text/plain" })
    fetched++
    if (robots.status === 200 && !/<html/i.test(robots.body.slice(0, 500))) disallowed = disallowedPaths(robots.body)
  } catch { /* no robots.txt: nothing is disallowed */ }

  // web app manifest
  const manifestHref = (html.match(/<link\b[^>]*rel\s*=\s*["']?manifest["']?[^>]*>/i)?.[0] ?? "").match(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)
  const manifestUrl = manifestHref ? (() => { try { return new URL(manifestHref[1] ?? manifestHref[2] ?? manifestHref[3], page.finalUrl).href } catch { return null } })() : null
  if (!manifestUrl) {
    results.push({ check_key: "pwa_manifest", attribute_key: "pwa_manifest", outcome: "not_found", value_state: "no", source_url: page.finalUrl, source_title: title, excerpt: "No <link rel=\"manifest\"> on the start page.", confidence: 90 })
  } else {
    try {
      const m = await fetcher(manifestUrl, { timeoutMs: left(), maxBytes: 200_000, accept: "application/manifest+json,application/json" })
      fetched++
      const json = m.status === 200 ? JSON.parse(m.body) as Record<string, unknown> : null
      const ok = Boolean(json && (json.name || json.short_name) && json.start_url !== undefined)
      results.push({ check_key: "pwa_manifest", attribute_key: "pwa_manifest", outcome: ok ? "found" : "not_found", value_state: ok ? "yes" : "no", source_url: manifestUrl, source_title: "Web app manifest", http_status: m.status, confidence: 95, detail: ok ? { display: json?.display ?? null } : { reason: "manifest has no name or start_url" } })
    } catch (e) {
      results.push({ check_key: "pwa_manifest", attribute_key: "pwa_manifest", outcome: "could_not_check", source_url: manifestUrl, detail: { error: message(e) } })
    }
  }

  // languages the start page declares
  const languages = declaredLanguages(html)
  if (languages.includes("de")) {
    results.push({ check_key: "german_available", attribute_key: "german_available", outcome: "found", value_state: "yes", source_url: page.finalUrl, source_title: title, excerpt: `Declared languages: ${languages.join(", ")}`, confidence: 70, detail: { languages } })
  } else {
    results.push({ check_key: "german_available", attribute_key: "german_available", outcome: "not_found", source_url: page.finalUrl, detail: { languages } })
  }

  // security.txt lives at one standard address, so its absence there is a real observation
  try {
    const s = await fetcher(`${origin}/.well-known/security.txt`, { timeoutMs: left(), maxBytes: 50_000, maxRedirects: 2, accept: "text/plain" })
    fetched++
    const ok = s.status === 200 && /^contact:/im.test(s.body) && !/<html/i.test(s.body.slice(0, 500))
    if (s.status >= 500) results.push({ check_key: "security_txt", attribute_key: "security_txt", outcome: "could_not_check", http_status: s.status })
    else results.push({ check_key: "security_txt", attribute_key: "security_txt", outcome: ok ? "found" : "not_found", value_state: ok ? "yes" : "no", source_url: `${origin}/.well-known/security.txt`, source_title: "security.txt", http_status: s.status, confidence: 95 })
  } catch (e) {
    results.push({ check_key: "security_txt", attribute_key: "security_txt", outcome: "could_not_check", detail: { error: message(e) } })
  }

  // documents the start page links to
  const candidates = discoverLinks(html, page.finalUrl)
  let budget = MAX_DOCUMENT_FETCHES
  const documents = await Promise.all(DOC_KINDS.map(async (kind): Promise<CheckResult> => {
    const attribute = DOC_ATTRIBUTE[kind]
    const c = candidates.get(kind)
    // No link on the start page proves nothing about the product: reported without an answer.
    if (!c) return { check_key: kind, attribute_key: attribute, outcome: "not_found", source_url: page.finalUrl, detail: { reason: "no link on the start page" } }
    const rule = RULES.find((r) => r.kind === kind)
    if (kind === "contact_available" && c.text === "mailto") {
      return { check_key: kind, attribute_key: attribute, outcome: "found", value_state: "yes", value_text: null, source_url: page.finalUrl, source_title: title, excerpt: "The start page offers an e-mail contact.", confidence: 80 }
    }
    if (!isAllowed(c.url, new URL(c.url).origin === origin ? disallowed : [])) {
      return { check_key: kind, attribute_key: attribute, outcome: "skipped", source_url: c.url, detail: { reason: "disallowed by robots.txt" } }
    }
    if (budget-- <= 0 || expired()) return { check_key: kind, attribute_key: attribute, outcome: "skipped", source_url: c.url, detail: { reason: "request budget used up" } }
    try {
      const doc = await fetcher(c.url, { timeoutMs: left(), maxBytes: 1_500_000, accept: "text/html,application/pdf;q=0.9,*/*;q=0.5" })
      fetched++
      if (doc.status >= 500 || doc.status === 429 || doc.status === 403) return { check_key: kind, attribute_key: attribute, outcome: "could_not_check", source_url: c.url, http_status: doc.status }
      if (doc.status !== 200) return { check_key: kind, attribute_key: attribute, outcome: "not_found", source_url: c.url, http_status: doc.status, detail: { reason: "the linked page did not load", link_text: c.text } }
      if (isPdf(doc)) {
        // a PDF cannot be read here; the link text and the address have to carry the meaning
        if (c.score < 4) return { check_key: kind, attribute_key: attribute, outcome: "not_found", source_url: doc.finalUrl, http_status: 200, detail: { reason: "PDF without a clear name", link_text: c.text } }
        return { check_key: kind, attribute_key: attribute, outcome: "found", value_state: "yes", value_text: doc.finalUrl, source_url: doc.finalUrl, source_title: c.text || "PDF document", http_status: 200, confidence: 70, detail: { format: "pdf", link_text: c.text } }
      }
      const quote = rule?.confirm ? confirmingExcerpt(doc.body, rule.confirm) : null
      if (rule?.confirm && !quote) return { check_key: kind, attribute_key: attribute, outcome: "not_found", source_url: doc.finalUrl, http_status: 200, detail: { reason: "the linked page does not read like this document", link_text: c.text } }
      return {
        check_key: kind, attribute_key: attribute, outcome: "found", value_state: "yes", value_text: doc.finalUrl, source_url: doc.finalUrl,
        source_title: pageTitle(doc.body) ?? c.text, excerpt: quote, http_status: 200, confidence: Math.min(95, 55 + c.score * 8), detail: { link_text: c.text },
      }
    } catch (e) {
      return { check_key: kind, attribute_key: attribute, outcome: "could_not_check", source_url: c.url, detail: { error: message(e) } }
    }
  }))
  results.push(...documents)

  // an API that is documented publicly is an available API; the documentation is the source
  const api = documents.find((d) => d.check_key === "api_docs")
  if (api?.outcome === "found") results.push({ ...api, check_key: "api_available", attribute_key: "api_available", confidence: Math.min(api.confidence ?? 70, 80) })
  else results.push({ check_key: "api_available", attribute_key: "api_available", outcome: api?.outcome === "could_not_check" ? "could_not_check" : "not_found", source_url: page.finalUrl })

  return { results, error: null, finalUrl: page.finalUrl, fetched }
}

export interface VerifyOutcome { ok: boolean; runId?: string; error?: string; found?: number; checked?: number }

/** Runs the checks for one listing and records the run. Service role only; clients can never write results. */
export async function verifyApp(appId: string, runType: "automatic" | "scheduled" | "maker_requested" | "manual", initiatedBy: string | null = null, deadlineMs = 25_000): Promise<VerifyOutcome> {
  const admin = createAdminClient()
  if (!admin) return { ok: false, error: "Verification needs the server-side service key." }
  const { data: app } = await admin.from("apps").select("id, url, status, is_demo").eq("id", appId).maybeSingle()
  if (!app) return { ok: false, error: "Unknown app." }
  if (app.is_demo) return { ok: false, error: "Sample listings are not verified: their sites do not exist." }

  const report = await inspectWebsite(app.url, safeFetch, deadlineMs)
  const { data: runId, error } = await admin.rpc("record_verification_run", {
    p_app_id: appId, p_url: app.url, p_run_type: runType, p_initiated_by: nullable(initiatedBy), p_results: asJson(report.results), p_error: nullable(report.error),
  })
  if (error) return { ok: false, error: "The run could not be saved. The app URL may have changed." }
  return { ok: true, runId: runId as string, found: report.results.filter((r) => r.outcome === "found").length, checked: report.results.length }
}

/** Listings that are due, oldest first. `next_check_at` is empty until a listing was checked once. */
export async function verifyDueApps(opts: { limit: number; deadlineMs: number }): Promise<{ checked: number; failed: number; remaining: number }> {
  const admin = createAdminClient()
  if (!admin) return { checked: 0, failed: 0, remaining: 0 }
  const started = Date.now()
  const { data: settings } = await admin.from("site_settings").select("value").eq("key", "verification").maybeSingle()
  const budget = Math.max(0, Math.min(opts.limit, Number((settings?.value as { daily_budget?: number } | null)?.daily_budget ?? opts.limit)))
  const { data: due } = await admin.from("apps").select("id").eq("status", "published").eq("is_demo", false).is("duplicate_of", null)
    .or(`next_check_at.is.null,next_check_at.lte.${new Date().toISOString()}`).order("next_check_at", { ascending: true, nullsFirst: true }).limit(budget)
  let checked = 0, failed = 0
  const list = due ?? []
  for (const app of list) {
    const left = opts.deadlineMs - (Date.now() - started)
    if (left < 8000) break
    const r = await verifyApp(app.id, "scheduled", null, Math.min(20_000, left - 3000))
    if (r.ok) checked++; else failed++
  }
  return { checked, failed, remaining: list.length - checked - failed }
}
