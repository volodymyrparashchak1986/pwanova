/**
 * The verification engine, without a network: a fake fetcher serves a small website.
 * What is tested is what the engine concludes, and above all what it refuses to conclude.
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createDb } from "./helpers/pg"
import type { SafeResponse } from "../src/lib/security/ssrf"
import { inspectWebsite, type CheckResult } from "../src/lib/v2/verify/engine"
import { confirmingExcerpt, declaredLanguages, disallowedPaths, discoverLinks, extractLinks, isAllowed, pageTitle, resolveLink } from "../src/lib/v2/verify/links"

type Page = { status?: number; body?: string; type?: string; finalUrl?: string } | Error
const site = (pages: Record<string, Page>) => {
  const requested: string[] = []
  const fetcher = async (url: string): Promise<SafeResponse> => {
    requested.push(url)
    const page = pages[url]
    if (page instanceof Error) throw page
    const { status = page ? 200 : 404, body = "", type = "text/html; charset=utf-8", finalUrl = url } = page ?? {}
    return { finalUrl, status, headers: new Headers({ "content-type": type }), bytes: new TextEncoder().encode(body), body, ms: 5, redirectedToHttp: false }
  }
  return { fetcher, requested }
}
const by = (results: CheckResult[], key: string) => results.find((r) => r.check_key === key)!
const html = (body: string, head = "") => `<!doctype html><html lang="en"><head><title>Acme</title>${head}</head><body>${body}</body></html>`
const HOME = "https://acme.example/"

describe("reading links from a page", () => {
  it("takes links with their visible text, and the label of a link that is only an icon", () => {
    const links = extractLinks(html(`
      <a href="/privacy">Privacy <b>Policy</b></a>
      <a href="https://github.com/acme/acme" aria-label="Source code"><svg><path d="M0"/></svg></a>
      <a href="#top">Top</a><a href="javascript:alert(1)">x</a><a href="data:text/html,x">y</a><a>no href</a>
      <!-- <a href="/commented-out">Imprint</a> -->
      <script>document.write('<a href="/from-script">Imprint</a>')</script>`))
    assert.deepEqual(links.map((l) => [l.href, l.text]), [["/privacy", "Privacy Policy"], ["https://github.com/acme/acme", "Source code"]])
  })
  it("resolves addresses against the page and refuses anything that is not plain http(s)", () => {
    assert.equal(resolveLink("/a#b", HOME)?.href, "https://acme.example/a")
    assert.equal(resolveLink("docs/api", "https://acme.example/en/")?.href, "https://acme.example/en/docs/api")
    assert.equal(resolveLink("ftp://acme.example/x", HOME), null)
    assert.equal(resolveLink("https://user:pw@acme.example/", HOME), null)
    assert.equal(resolveLink("http://[", HOME), null)
  })
  it("reads the languages a page declares", () => {
    assert.deepEqual(declaredLanguages('<html lang="de-DE"><head><link rel="alternate" hreflang="en" href="/en"><link rel="alternate" hreflang="x-default" href="/"><link rel="stylesheet" hreflang="fr" href="/x.css">'), ["de", "en"])
    assert.deepEqual(declaredLanguages("<html><head></head>"), [])
  })
  it("reads a title and a quote around the confirming word", () => {
    assert.equal(pageTitle("<title>\n  Privacy &amp; Cookies \n</title>"), "Privacy & Cookies")
    assert.equal(pageTitle("<p>no title</p>"), null)
    const quote = confirmingExcerpt(html(`<style>.privacy{}</style><p>${"Intro. ".repeat(30)}We process personal data only as described here.</p>`), /personal data/i)!
    assert.ok(quote.includes("personal data") && quote.length <= 222 && quote.startsWith("…"))
    assert.equal(confirmingExcerpt(html("<p>Nothing relevant.</p>"), /personal data/i), null)
  })
})

describe("finding documents among the links", () => {
  const found = (body: string) => Object.fromEntries([...discoverLinks(html(body), HOME)].map(([k, c]) => [k, c.url]))

  it("recognises the usual documents in English and in German", () => {
    assert.deepEqual(found(`
      <a href="/privacy">Privacy</a><a href="/imprint">Imprint</a><a href="/terms">Terms of Service</a>
      <a href="/legal/dpa">Data Processing Agreement</a><a href="/subprocessors">Sub-processors</a><a href="/pricing">Pricing</a>
      <a href="/docs/api">API reference</a><a href="/changelog">Changelog</a><a href="/contact">Contact</a><a href="/mcp">MCP server</a>`), {
      privacy_policy: "https://acme.example/privacy", legal_notice: "https://acme.example/imprint", terms_of_service: "https://acme.example/terms",
      dpa_available: "https://acme.example/legal/dpa", subprocessors_published: "https://acme.example/subprocessors", pricing_page: "https://acme.example/pricing",
      api_docs: "https://acme.example/docs/api", changelog: "https://acme.example/changelog", contact_available: "https://acme.example/contact", mcp_available: "https://acme.example/mcp",
    })
    assert.deepEqual(found(`<a href="/datenschutz">Datenschutz</a><a href="/impressum">Impressum</a><a href="/agb">AGB</a><a href="/avv">Auftragsverarbeitung</a><a href="/preise">Preise</a><a href="/kontakt">Kontakt</a>`), {
      privacy_policy: "https://acme.example/datenschutz", legal_notice: "https://acme.example/impressum", terms_of_service: "https://acme.example/agb",
      dpa_available: "https://acme.example/avv", pricing_page: "https://acme.example/preise", contact_available: "https://acme.example/kontakt",
    })
  })
  it("does not take a data processing agreement for a privacy policy, or the other way round", () => {
    const f = found(`<a href="/privacy">Privacy Policy</a><a href="/privacy/dpa">Data Processing Addendum</a>`)
    assert.equal(f.privacy_policy, "https://acme.example/privacy")
    assert.equal(f.dpa_available, "https://acme.example/privacy/dpa")
  })
  it("a pricing page belongs to the product's own site", () => {
    assert.equal(found(`<a href="https://other.example/pricing">Pricing</a>`).pricing_page, undefined)
    assert.equal(found(`<a href="https://www.acme.example/pricing">Pricing</a>`).pricing_page, "https://www.acme.example/pricing")
  })
  it("takes a repository, not a page of the hosting site, and prefers the one that carries the product's name", () => {
    assert.equal(found(`<a href="https://github.com/features">Features</a><a href="https://github.com/login">Sign in</a>`).source_repository, undefined)
    assert.equal(found(`<a href="https://github.com/vercel/next.js">Built with Next.js</a><a href="https://github.com/acme/acme-app.git">GitHub</a>`).source_repository, "https://github.com/acme/acme-app")
    assert.equal(found(`<a href="https://codeberg.org/someone/tool/issues/4">Issue</a>`).source_repository, "https://codeberg.org/someone/tool")
  })
  it("an e-mail link is a way to make contact; nothing else is read from it", () => {
    const c = discoverLinks(html(`<a href="mailto:hello@acme.example">Write to us</a>`), HOME).get("contact_available")!
    assert.deepEqual([c.url, c.text], [HOME, "mailto"])
  })
  it("ordinary navigation is not mistaken for a document", () => {
    assert.deepEqual(found(`<a href="/">Home</a><a href="/blog/our-privacy-story-in-2026">Blog</a><a href="/features">Features</a><a href="/login">Log in</a>
      <a href="/blog/pricing-changes">Read why we think that privacy matters, how we changed our pricing and what the terms mean for the imprint of a product</a>`), {})
  })
  it("an address counts by its last part, with or without an extension", () => {
    assert.equal(found(`<a href="/legal/privacy-policy.html">Legal</a>`).privacy_policy, "https://acme.example/legal/privacy-policy.html")
    assert.equal(found(`<a href="/de/datenschutz/">Rechtliches</a>`).privacy_policy, "https://acme.example/de/datenschutz/")
    assert.equal(found(`<a href="/privacy/settings">Settings</a>`).privacy_policy, undefined)
  })
})

describe("robots.txt", () => {
  const robots = `# comment\nUser-agent: *\nDisallow: /private\nDisallow: /*.pdf$\n\nUser-agent: PWANovaBot\nDisallow: /legal/\nAllow: /\n\nUser-agent: OtherBot\nDisallow: /`
  it("follows the rules written for PWANovaBot, otherwise the rules for everybody", () => {
    assert.deepEqual(disallowedPaths(robots), ["/legal/"])
    assert.deepEqual(disallowedPaths("User-agent: *\nDisallow: /private\nDisallow:"), ["/private"])
    assert.deepEqual(disallowedPaths("User-agent: a\nUser-agent: *\nDisallow: /x"), ["/x"])
    assert.deepEqual(disallowedPaths(""), [])
  })
  it("matches paths from the start, with wildcards", () => {
    assert.ok(!isAllowed("https://acme.example/legal/dpa", ["/legal/"]))
    assert.ok(isAllowed("https://acme.example/legal", ["/legal/"]))
    assert.ok(!isAllowed("https://acme.example/docs/terms.pdf", ["/*.pdf$"]))
    assert.ok(isAllowed("https://acme.example/docs/terms.pdf.html", ["/*.pdf$"]))
    assert.ok(isAllowed("https://acme.example/anything", []))
    assert.ok(!isAllowed("not a url", []))
  })
})

describe("what a verification run concludes", () => {
  it("reports on exactly the facts the registry calls automatically checked", async () => {
    const { fetcher } = site({ [HOME]: { body: html(`<a href="/docs/api">API documentation</a>`) } })
    const reported = new Set((await inspectWebsite(HOME, fetcher)).results.map((r) => r.attribute_key))
    const db = await createDb()
    try {
      const { rows } = await db.query<{ key: string }>("select key from public.fact_attributes where auto_checkable order by key")
      assert.deepEqual(rows.map((r) => r.key), [...reported].filter((k): k is string => Boolean(k)).sort())
    } finally { await db.close() }
  })

  const home = html(`
    <a href="/privacy">Privacy</a><a href="/imprint">Imprint</a><a href="/dpa">DPA</a><a href="/terms">Terms</a>
    <a href="/pricing">Pricing</a><a href="/docs/api">API docs</a><a href="https://github.com/acme/acme">GitHub</a>`,
    `<link rel="manifest" href="/app.webmanifest"><link rel="alternate" hreflang="de" href="/de">`)

  it("a document counts after its own page was read and reads like that document", async () => {
    const { fetcher } = site({
      [HOME]: { body: home },
      "https://acme.example/privacy": { body: html("<h1>Privacy</h1><p>We process personal data as follows.</p>") },
      "https://acme.example/imprint": { status: 404 },
      "https://acme.example/dpa": { status: 503 },
      "https://acme.example/terms": { body: html("<h1>Welcome</h1><p>Our product is great.</p>") },
      "https://acme.example/pricing": { body: html("<p>Free for one person. Team: €9 per month.</p>") },
      "https://acme.example/docs/api": { body: html("<h1>REST API</h1><p>Authentication uses a token.</p>") },
      "https://github.com/acme/acme": { body: html("<p>repository</p>") },
      "https://acme.example/app.webmanifest": { body: JSON.stringify({ name: "Acme", start_url: "/", display: "standalone" }), type: "application/manifest+json" },
      "https://acme.example/.well-known/security.txt": { status: 404 },
    })
    const { results, error } = await inspectWebsite(HOME, fetcher)
    assert.equal(error, null)

    const privacy = by(results, "privacy_policy")
    assert.deepEqual([privacy.outcome, privacy.value_state, privacy.source_url], ["found", "yes", "https://acme.example/privacy"])
    assert.ok(privacy.excerpt?.includes("personal data"))

    // the link is there but the page is gone: not found, and no answer
    assert.deepEqual([by(results, "legal_notice").outcome, by(results, "legal_notice").value_state], ["not_found", undefined])
    // the server failed: could not check
    assert.deepEqual([by(results, "dpa_available").outcome, by(results, "dpa_available").value_state], ["could_not_check", undefined])
    // the page loads but does not read like terms
    assert.deepEqual([by(results, "terms_of_service").outcome, by(results, "terms_of_service").value_state], ["not_found", undefined])
    // no link at all
    assert.deepEqual([by(results, "subprocessors_published").outcome, by(results, "subprocessors_published").value_state], ["not_found", undefined])

    assert.deepEqual([by(results, "pricing_page").outcome, by(results, "api_docs").outcome, by(results, "source_repository").outcome], ["found", "found", "found"])
    assert.deepEqual([by(results, "api_available").outcome, by(results, "api_available").value_state, by(results, "api_available").source_url], ["found", "yes", "https://acme.example/docs/api"])
    assert.deepEqual([by(results, "pwa_manifest").value_state, by(results, "https").value_state, by(results, "website_reachable").value_state, by(results, "german_available").value_state], ["yes", "yes", "yes", "yes"])
    // one standard address: its absence there is a real observation
    assert.deepEqual([by(results, "security_txt").outcome, by(results, "security_txt").value_state], ["not_found", "no"])
  })

  it("a missing document never becomes a no", async () => {
    const { fetcher } = site({ [HOME]: { body: html("<p>A page without any links.</p>") } })
    const { results } = await inspectWebsite(HOME, fetcher)
    const technical = ["pwa_manifest", "security_txt", "https", "website_reachable"]
    for (const r of results) {
      if (technical.includes(r.check_key)) continue
      assert.notEqual(r.value_state, "no", `${r.check_key} must not be answered with no`)
    }
    assert.deepEqual(results.filter((r) => r.value_state === "no").map((r) => r.check_key).sort(), ["pwa_manifest", "security_txt"])
    assert.equal(by(results, "german_available").value_state, undefined, "a page in English does not prove that there is no German")
  })

  it("when the site cannot be reached, nothing is concluded at all", async () => {
    const { fetcher, requested } = site({ [HOME]: new Error("connect ETIMEDOUT") })
    const { results, error } = await inspectWebsite(HOME, fetcher)
    assert.equal(error, "connect ETIMEDOUT")
    assert.ok(results.length >= 15)
    assert.ok(results.every((r) => r.outcome === "could_not_check" && r.value_state === undefined))
    assert.deepEqual(requested, [HOME])
  })

  it("a server error on the start page is not a statement about the product", async () => {
    const { fetcher } = site({ [HOME]: { status: 502, body: "Bad gateway" } })
    const { results } = await inspectWebsite(HOME, fetcher)
    assert.equal(by(results, "website_reachable").outcome, "could_not_check")
    assert.ok(results.filter((r) => r.check_key !== "https").every((r) => r.value_state === undefined))
  })

  it("stays away from pages the site closes to robots", async () => {
    const { fetcher, requested } = site({
      [HOME]: { body: html(`<a href="/legal/privacy">Privacy</a><a href="/imprint">Imprint</a>`) },
      "https://acme.example/robots.txt": { body: "User-agent: *\nDisallow: /legal/", type: "text/plain" },
      "https://acme.example/imprint": { body: html("<h1>Imprint</h1><p>Responsible for content: Acme GmbH</p>") },
    })
    const { results } = await inspectWebsite(HOME, fetcher)
    assert.deepEqual([by(results, "privacy_policy").outcome, by(results, "privacy_policy").value_state], ["skipped", undefined])
    assert.equal(by(results, "legal_notice").outcome, "found")
    assert.ok(!requested.includes("https://acme.example/legal/privacy"))
  })

  it("a PDF counts only when its name and address leave no doubt", async () => {
    const pdf = { body: "%PDF-1.7", type: "application/pdf" }
    const { fetcher } = site({
      [HOME]: { body: html(`<a href="/files/dpa.pdf">Data Processing Agreement</a><a href="/files/doc-17.pdf">Privacy</a>`) },
      "https://acme.example/files/dpa.pdf": pdf, "https://acme.example/files/doc-17.pdf": pdf,
    })
    const { results } = await inspectWebsite(HOME, fetcher)
    assert.deepEqual([by(results, "dpa_available").outcome, by(results, "dpa_available").value_state], ["found", "yes"])
    assert.deepEqual([by(results, "privacy_policy").outcome, by(results, "privacy_policy").value_state], ["not_found", undefined])
  })

  it("a broken manifest is a manifest that is not valid; a manifest that cannot be fetched is not judged", async () => {
    const head = `<link rel="manifest" href="/m.json">`
    const broken = await inspectWebsite(HOME, site({ [HOME]: { body: html("", head) }, "https://acme.example/m.json": { body: JSON.stringify({ icons: [] }) } }).fetcher)
    assert.deepEqual([by(broken.results, "pwa_manifest").outcome, by(broken.results, "pwa_manifest").value_state], ["not_found", "no"])
    const down = await inspectWebsite(HOME, site({ [HOME]: { body: html("", head) }, "https://acme.example/m.json": new Error("socket hang up") }).fetcher)
    assert.deepEqual([by(down.results, "pwa_manifest").outcome, by(down.results, "pwa_manifest").value_state], ["could_not_check", undefined])
    const garbage = await inspectWebsite(HOME, site({ [HOME]: { body: html("", head) }, "https://acme.example/m.json": { body: "<html>not json</html>" } }).fetcher)
    assert.equal(by(garbage.results, "pwa_manifest").outcome, "could_not_check")
  })

  it("sends a bounded number of requests, to http(s) addresses only", async () => {
    const many = Array.from({ length: 60 }, (_, i) => `<a href="/privacy-${i}">Privacy</a><a href="javascript:x()">Imprint</a><a href="file:///etc/passwd">Terms</a>`).join("")
    const { fetcher, requested } = site({ [HOME]: { body: html(many + `<a href="/imprint">Imprint</a><a href="/terms">Terms</a><a href="/dpa">DPA</a><a href="/pricing">Pricing</a>`) } })
    const { fetched } = await inspectWebsite(HOME, fetcher)
    assert.ok(requested.length <= 16, `${requested.length} requests`)
    assert.equal(fetched, requested.length)
    assert.ok(requested.every((u) => /^https:\/\//.test(u)))
    assert.equal(new Set(requested).size, requested.length, "no address is requested twice")
  })

  it("stops when its time is up and reports what it did not get to", async () => {
    const slow = site({ [HOME]: { body: home } })
    const fetcher = async (url: string) => { await new Promise((r) => setTimeout(r, 30)); return slow.fetcher(url) }
    const { results } = await inspectWebsite(HOME, fetcher, 40)
    assert.ok(results.some((r) => r.outcome === "skipped" && r.detail?.reason === "request budget used up"))
    assert.ok(results.every((r) => r.outcome !== "found" || r.value_state === "yes"))
  })
})
