/**
 * Editorial catalog import. Lists REAL web apps from scripts/catalog-candidates.ts.
 *
 *   npm run import:apps -- --probe                  analyse every candidate live, write nothing
 *   npm run import:apps -- --apply                  insert candidates that pass the live checks
 *   npm run import:apps -- --apply --only=a,b        limit to the given slugs
 *
 * Runs with the service role (reads .env.local), so it targets whatever project .env.local points at.
 * Rules it never breaks: nothing fabricated (no ratings, no installs, no "verified" badge), listings
 * are skipped when the app is unreachable or not served by the expected host, and existing listings
 * are never overwritten.
 */
import { analyzeUrl, type AnalysisResult } from "@/lib/analyzer"
import { runAppChecks } from "@/lib/checks"
import { cleanText } from "@/lib/security/sanitize"
import { createAdminClient } from "@/lib/supabase/admin"
import { canonicalAppUrl, domainOf, slugify } from "@/lib/url"
import { CANDIDATES, type Candidate } from "./catalog-candidates"
import { assertAllowedTarget } from "./env-guard"

const args = new Set(process.argv.slice(2).filter((a) => !a.startsWith("--only=")))
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",").filter(Boolean)
const apply = args.has("--apply")
if (!apply && !args.has("--probe")) {
  console.error("Usage: import-apps --probe | --apply [--only=slug1,slug2]")
  process.exit(2)
}

const CLAIM_TTL_DAYS = 14
const CONCURRENCY = 6

type Probe = { c: Candidate; slug: string; a: AnalysisResult | null; error?: string }

function slugFor(c: Candidate) {
  return c.slug ?? slugify(c.name)
}

async function probeAll(list: Candidate[]): Promise<Probe[]> {
  const out: Probe[] = []
  let i = 0
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (i < list.length) {
      const c = list[i++]
      try {
        out.push({ c, slug: slugFor(c), a: await analyzeUrl(c.url) })
      } catch (e) {
        out.push({ c, slug: slugFor(c), a: null, error: e instanceof Error ? e.message : String(e) })
      }
    }
  }))
  return out.sort((x, y) => list.indexOf(x.c) - list.indexOf(y.c))
}

function verdict(p: Probe): { ok: boolean; why: string } {
  if (!p.a) return { ok: false, why: p.error ?? "analysis failed" }
  if (!p.a.reachable) return { ok: false, why: `unreachable (HTTP ${p.a.checks.status_code ?? "-"}) ${p.a.notes.join("; ")}`.trim() }
  const want = p.c.onlyIfHost ?? "vercel"
  if (want !== "any" && p.a.host !== want) return { ok: false, why: `host is ${p.a.host} (${p.a.hostSignal ?? "no signal"}), wanted ${want}` }
  return { ok: true, why: p.a.hostSignal ?? p.a.host }
}

function taglineFor(c: Candidate, a: AnalysisResult) {
  return cleanText(c.tagline || a.description.split(/(?<=[.!?])\s/)[0] || a.title, 120)
}

async function main() {
  const list = only ? CANDIDATES.filter((c) => only.includes(slugFor(c))) : CANDIDATES
  console.log(`${apply ? "APPLY" : "PROBE"}: ${list.length} candidate(s)\n`)
  const probes = await probeAll(list)

  const rows = probes.map((p) => {
    const v = verdict(p)
    return { slug: p.slug, ok: v.ok ? "yes" : "no", host: p.a?.host ?? "-", http: p.a?.checks.status_code ?? "-", manifest: p.a ? (p.a.checks.manifest_ok ? "yes" : "no") : "-", icon: p.a?.iconUrl ? "yes" : "no", note: v.why.slice(0, 70) }
  })
  console.table(rows)
  if (!apply) {
    for (const p of probes) if (p.a?.reachable) console.log(`${p.slug}: title="${p.a.title}" | ${p.a.description.slice(0, 160)}`)
    return
  }

  assertAllowedTarget(process.env.NEXT_PUBLIC_SUPABASE_URL, "import:apps --apply")
  const admin = createAdminClient()
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL missing")

  const owners = new Map<string, string>()
  for (const u of new Set(list.map((c) => c.ownerUsername).filter((x): x is string => Boolean(x)))) {
    const { data } = await admin.from("profiles").select("id").eq("username", u).maybeSingle()
    if (!data) throw new Error(`Owner profile not found: ${u}`)
    owners.set(u, data.id)
  }

  const claims: string[] = []
  let inserted = 0, skipped = 0
  // Insert in candidate order so "new" sorting keeps the editorial order stable; owner apps come first
  // in the list but are inserted last so they also lead the "New & Rising" section.
  const ordered = [...probes.filter((p) => !p.c.ownerUsername), ...probes.filter((p) => p.c.ownerUsername)]
  for (const p of ordered) {
    const v = verdict(p)
    if (!v.ok || !p.a) { skipped++; console.log(`skip  ${p.slug}: ${v.why}`); continue }
    const a = p.a
    const url = canonicalAppUrl(a.finalUrl)
    const domain = domainOf(url)

    const { data: existing } = await admin.from("apps").select("slug").or(`url.eq.${url},slug.eq.${p.slug}`).limit(1)
    if (existing?.length) { skipped++; console.log(`exist ${p.slug}: already listed as ${existing[0].slug}`); continue }

    const ownerId = p.c.ownerUsername ? owners.get(p.c.ownerUsername) ?? null : null
    const { data: app, error } = await admin.from("apps").insert({
      developer_id: ownerId,
      name: cleanText(p.c.name, 80), slug: p.slug, tagline: taglineFor(p.c, a),
      description: cleanText(a.description, 4000) || null,
      url, domain, icon_url: a.iconUrl, category: p.c.category,
      build_tool: p.c.buildTool ?? "other", hosting_provider: a.host,
      status: "published",
      ownership_status: ownerId ? "claim_pending" : "unclaimed",
      is_featured: Boolean(p.c.featured), featured_at: p.c.featured ? new Date().toISOString() : null,
    }).select("id, slug").single()
    if (error || !app) { skipped++; console.log(`fail  ${p.slug}: ${error?.message ?? "insert failed"}`); continue }

    if (a.screenshots.length) await admin.from("app_screenshots").insert(a.screenshots.map((image_url, i) => ({ app_id: app.id, image_url, sort_order: i })))

    if (ownerId) {
      const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "")
      const expires_at = new Date(Date.now() + CLAIM_TTL_DAYS * 86_400_000).toISOString()
      const { error: claimError } = await admin.from("app_claims").insert({ app_id: app.id, user_id: ownerId, token, bound_url: url, expires_at, status: "pending" })
      if (claimError) console.log(`warn  ${p.slug}: claim token not created (${claimError.message})`)
      else claims.push(`${p.slug}: serve ${new URL(url).origin}/.well-known/pwanova-verification.txt containing exactly: ${token}`)
    }

    const checks = await runAppChecks(app.id)
    inserted++
    console.log(`added ${p.slug} (${domain}) checks=${checks.ok ? "recorded" : checks.error}`)
  }

  console.log(`\ninserted ${inserted}, skipped ${skipped}`)
  if (claims.length) console.log(`\nOwnership claims issued (valid ${CLAIM_TTL_DAYS} days):\n  ${claims.join("\n  ")}`)
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
