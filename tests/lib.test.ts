import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isPrivateIp, parsePublicUrl, slugify, UrlError } from "../src/lib/url"
import { classifyTraffic } from "../src/lib/traffic"
import { cleanHttpUrl, cleanText, jsonLd } from "../src/lib/security/sanitize"
import { safeNext } from "../src/lib/safe-next"
import { rankingScore } from "../src/lib/ranking"
import { detectHost } from "../src/lib/analyzer-host"
import { detectPlatform } from "../src/lib/platform"
import { filterDemoApps, demo } from "../src/lib/data/demo"
import { hasMetaToken, txtRecordMatches, wellKnownMatches } from "../src/lib/verification-utils"

describe("URL validation", () => {
  const bad = [
    "javascript:alert(1)", "data:text/html,<script>1</script>", "file:///etc/passwd", "ftp://example.com",
    "http://localhost", "https://localhost:3000", "http://127.0.0.1", "http://2130706433", "http://0x7f.0.0.1",
    "http://10.0.0.5", "http://192.168.1.1", "http://172.16.5.4", "http://169.254.169.254/latest/meta-data", "http://[::1]/", "http://[fd00::1]/",
    "http://foo.internal", "http://printer.local", "http://user:pass@example.com", "https://example.com:8443", "http://intranet",
  ]
  for (const u of bad) it(`blocks ${u}`, () => assert.throws(() => parsePublicUrl(u), UrlError))
  it("accepts public https URLs and normalises bare domains", () => {
    assert.equal(parsePublicUrl("https://my-app.vercel.app/x#frag").href, "https://my-app.vercel.app/x")
    assert.equal(parsePublicUrl("example.com").protocol, "https:")
  })
  it("classifies private IPs", () => {
    for (const ip of ["10.1.1.1", "127.0.0.1", "100.64.0.1", "::1", "fe80::1", "::ffff:10.0.0.1"]) assert.ok(isPrivateIp(ip), ip)
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700::1111"]) assert.ok(!isPrivateIp(ip), ip)
  })
  it("slugify", () => assert.equal(slugify("AI Notes!!"), "ai-notes"))
})

describe("sanitisation", () => {
  it("strips tags and control chars", () => assert.equal(cleanText(`<b>hi</b>${String.fromCharCode(0)} there<script>x</script>`, 50), "hi therex"))
  it("only allows http(s) urls", () => {
    assert.equal(cleanHttpUrl("javascript:alert(1)"), null)
    assert.equal(cleanHttpUrl("data:image/png;base64,AAAA"), null)
    assert.equal(cleanHttpUrl("https://ok.example/a.png"), "https://ok.example/a.png")
  })
  it("json-ld cannot break out of a script tag", () => assert.ok(!jsonLd({ a: "</script><script>alert(1)" }).includes("</script>")))
  it("safeNext blocks open redirects", () => {
    for (const n of ["//evil.com", "https://evil.com", "/\\evil.com", "javascript:1"]) assert.equal(safeNext(n), "/")
    assert.equal(safeNext("/apps/x?y=1"), "/apps/x?y=1")
  })
})

describe("traffic classification", () => {
  const base = { siteHost: "pwanova.app" }
  it("partner attribution wins", () => assert.equal(classifyTraffic({ ...base, hasPartner: true, referrer: "https://google.com" }), "partner"))
  it("internal markers", () => {
    assert.equal(classifyTraffic({ ...base, hasPartner: false, from: "search" }), "pwanova_search")
    assert.equal(classifyTraffic({ ...base, hasPartner: false, from: "home" }), "homepage")
  })
  it("referrers", () => {
    assert.equal(classifyTraffic({ ...base, hasPartner: false, referrer: "https://www.google.com/search?q=x" }), "google")
    assert.equal(classifyTraffic({ ...base, hasPartner: false, referrer: "https://www.producthunt.com/posts/x" }), "product_hunt")
    assert.equal(classifyTraffic({ ...base, hasPartner: false, referrer: "https://t.co/abc" }), "social")
    assert.equal(classifyTraffic({ ...base, hasPartner: false, referrer: "https://blog.example.org" }), "other")
    assert.equal(classifyTraffic({ ...base, hasPartner: false }), "direct")
  })
})

describe("host detection", () => {
  it("detects by domain and headers", () => {
    assert.equal(detectHost(new URL("https://a.vercel.app"), new Headers()).host, "vercel")
    assert.equal(detectHost(new URL("https://a.com"), new Headers({ "x-vercel-id": "1" })).host, "vercel")
    assert.equal(detectHost(new URL("https://a.com"), new Headers({ "x-nf-request-id": "1" })).host, "netlify")
    assert.equal(detectHost(new URL("https://a.com"), new Headers()).host, "custom-domain")
  })
})

describe("platform detection", () => {
  it("ios / android / desktop", () => {
    assert.equal(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1", 5), "ios")
    assert.equal(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari", 5), "ios") // iPadOS desktop UA
    assert.equal(detectPlatform("Mozilla/5.0 (Linux; Android 14) Chrome/120", 5), "android")
    assert.equal(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120", 0), "desktop")
  })
})

describe("ranking + demo search", () => {
  it("many good ratings beat one perfect rating", () => {
    const one = rankingScore({ rating: 5, ratingsCount: 1, reviewsCount: 1, favoritesCount: 0, opens30d: 60, opens7d: 10, qualityPassed: 5 })
    const many = rankingScore({ rating: 4.6, ratingsCount: 300, reviewsCount: 40, favoritesCount: 90, opens30d: 900, opens7d: 200, qualityPassed: 5 })
    assert.ok(many > one)
  })
  it("search covers name, developer, category, build tool, host and launch source", () => {
    const apps = demo().apps
    const hit = (q: string) => filterDemoApps(apps, { q }).map((a) => a.slug)
    assert.ok(hit("metro").includes("metro-fit"))
    assert.ok(hit("nova labs").includes("metro-fit")) // developer
    assert.ok(hit("fitness").includes("metro-fit")) // category
    assert.ok(hit("claude code").includes("metro-fit")) // built with
    assert.ok(hit("railway").includes("devmonitor")) // hosting
    assert.ok(hit("peerlist").includes("invoicelite")) // launch source
    assert.deepEqual(hit("zzzzzz"), [])
  })
  it("filters: verified, built with, host", () => {
    const apps = demo().apps
    assert.ok(filterDemoApps(apps, { verified: true }).every((a) => a.verificationStatus === "verified"))
    assert.ok(filterDemoApps(apps, { build: "v0" }).every((a) => a.buildTool === "v0"))
    assert.ok(filterDemoApps(apps, { host: "vercel" }).every((a) => a.hostingProvider === "vercel"))
  })
})

describe("ownership verification helpers", () => {
  const token = "c5e4e87857fb40e8a2af7e07cc354ba7"
  it("finds the meta tag in either attribute order, any quoting or case", () => {
    assert.ok(hasMetaToken(`<html><head><meta name="pwanova-verification" content="${token}"></head>`, token))
    assert.ok(hasMetaToken(`<head><meta content='${token}' name='pwanova-verification' /></head>`, token))
    assert.ok(hasMetaToken(`<HEAD><META NAME="PWANOVA-VERIFICATION" CONTENT="${token}"></HEAD>`, token))
  })
  it("rejects wrong tokens, other meta names and tokens outside <head> or inside comments", () => {
    assert.ok(!hasMetaToken(`<head><meta name="pwanova-verification" content="deadbeef"></head>`, token))
    assert.ok(!hasMetaToken(`<head><meta name="description" content="${token}"></head>`, token))
    assert.ok(!hasMetaToken(`<head></head><body><meta name="pwanova-verification" content="${token}"></body>`, token))
    assert.ok(!hasMetaToken(`<head><!-- <meta name="pwanova-verification" content="${token}"> --></head>`, token))
  })
  it("well-known file must contain exactly the token", () => {
    assert.ok(wellKnownMatches(`${token}\n`, token))
    assert.ok(!wellKnownMatches(`${token} extra`, token))
    assert.ok(!wellKnownMatches("", token))
  })
  it("DNS TXT records are joined and matched exactly", () => {
    assert.ok(txtRecordMatches([["v=spf1 -all"], [`pwanova-verification=${token.slice(0, 10)}`, token.slice(10)]], token))
    assert.ok(!txtRecordMatches([[`pwanova-verification=${token}x`]], token))
  })
})
