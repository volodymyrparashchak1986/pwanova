import { NextResponse, type NextRequest } from "next/server"
import { getAppByDomain } from "@/lib/data"
import { clientIp, rateLimit } from "@/lib/security/rate-limit"
import { siteUrl } from "@/lib/env"
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
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return NextResponse.json({ error: "Provide a valid ?domain=example.com" }, { status: 400, headers: CORS })
  }
  const app = await getAppByDomain(domain)
  if (!app) return NextResponse.json({ error: "App not found" }, { status: 404, headers: { ...CORS, "cache-control": "public, s-maxage=60" } })
  return NextResponse.json({
    name: app.name,
    slug: app.slug,
    rating: app.rating,
    ratingsCount: app.ratingsCount,
    reviewsCount: app.reviewsCount,
    verified: app.verificationStatus === "verified",
    installable: app.isInstallable,
    pwa: app.isPwa,
    host: labelFor.host(app.hostingProvider),
    developer: app.developer.username ? { username: app.developer.username, name: app.developer.name, verifiedOwner: app.ownershipStatus === "verified_owner" } : null,
    demo: app.isDemo,
    url: `${siteUrl}/apps/${app.slug}`,
  }, { headers: { ...CORS, "cache-control": "public, s-maxage=300, stale-while-revalidate=600" } })
}
