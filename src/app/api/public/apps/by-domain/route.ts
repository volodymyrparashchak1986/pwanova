import { NextResponse, type NextRequest } from "next/server"
import { getAppByDomain } from "@/lib/data"
import { clientIp, rateLimit } from "@/lib/security/rate-limit"
import { siteUrl } from "@/lib/env"
import { canonicalAppUrl } from "@/lib/url"
import { labelFor } from "@/lib/constants"

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS" }
export const OPTIONS = () => new NextResponse(null, { status: 204, headers: CORS })

/** Public partner API: GET /api/public/apps/by-domain?domain=example.com */
export async function GET(req: NextRequest) {
  if (!(await rateLimit(`api:${await clientIp()}`, 60, 60))) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again in a minute." }, { status: 429, headers: { ...CORS, "retry-after": "60" } })
  }
  const raw = req.nextUrl.searchParams.get("domain")?.trim().toLowerCase() ?? ""
  let domain = ""
  try { domain = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname } catch { /* invalid */ }
  const rawUrl = req.nextUrl.searchParams.get("url")
  const id = req.nextUrl.searchParams.get("id")
  if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400, headers: CORS })
  if (!id && !rawUrl && (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain))) {
    return NextResponse.json({ error: "Provide a valid ?domain=example.com" }, { status: 400, headers: CORS })
  }
  let app
  try { app = await getAppByDomain(domain, rawUrl ? canonicalAppUrl(rawUrl) : undefined, id ?? undefined) }
  catch (error) {
    const ambiguous = error instanceof Error && error.message === "AMBIGUOUS_DOMAIN"
    return NextResponse.json({ error: ambiguous ? "Multiple apps use this domain; provide ?url= or ?id=" : "Invalid URL" }, { status: ambiguous ? 409 : 400, headers: { ...CORS, "cache-control": "no-store" } })
  }
  // Suspended/hidden/pending/rejected apps never leak here: getAppByDomain reads apps_public, which
  // only ever contains status = 'published' (see supabase/migrations/20260101000200_views.sql).
  if (!app) return NextResponse.json({ error: "App not found" }, { status: 404, headers: { ...CORS, "cache-control": "no-store" } })
  return NextResponse.json({
    id: app.id,
    name: app.name,
    slug: app.slug,
    rating: app.ratingsCount ? app.rating : null, // null, not 0 — "no ratings yet" is not the same as a 0-star average
    ratingsCount: app.ratingsCount,
    reviewsCount: app.reviewsCount,
    ownershipStatus: app.ownershipStatus,
    ownership: { status: app.ownershipStatus, method: app.ownershipMethod ?? null, checkedAt: app.ownershipVerifiedAt ?? null },
    verified: app.ownershipStatus === "verified_owner", // deprecated alias: ownership only
    installable: app.checks?.installable ?? null,
    pwa: app.isPwa,
    host: labelFor.host(app.hostingProvider),
    checks: app.checks ? {
      method: app.checks.method, evidence: app.checks.evidence, reachable: app.checks.reachable, httpsOk: app.checks.httpsOk, manifestOk: app.checks.manifestOk,
      serviceWorkerOk: app.checks.serviceWorkerOk, installable: app.checks.installable,
      offlineSupport: app.checks.offlineSupport, pushSupport: app.checks.pushSupport, // null = not checked / unknown, never a guessed value
    } : null,
    lastCheckedAt: app.checks?.lastCheckedAt ?? null,
    developer: app.developer.username ? { username: app.developer.username, name: app.developer.name, verifiedOwner: app.ownershipStatus === "verified_owner" } : null,
    demo: app.isDemo, // true only if SHOW_DEMO_DATA=true on this deployment let a fabricated app through at all
    url: `${siteUrl}/apps/${app.slug}`,
    installGuidanceUrl: `${siteUrl}/apps/${app.slug}#install`,
    badgeUrl: `${siteUrl}/api/badge/${app.slug}`,
    embedUrl: `${siteUrl}/embed/app/${app.slug}`,
  }, { headers: { ...CORS, "cache-control": "no-store" } })
}
