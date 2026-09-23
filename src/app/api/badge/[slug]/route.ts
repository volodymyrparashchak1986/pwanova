import { NextResponse, type NextRequest } from "next/server"
import { getAppBySlug } from "@/lib/data"
import { badgeNotFoundSvg, badgeSvg } from "@/lib/badge-svg"
import { exampleApp, isExampleSlug } from "@/lib/partner-example"
import { clientIp, rateLimit } from "@/lib/security/rate-limit"

/**
 * Part B of the Partner Kit: a plain SVG image badge, for launch boards that just want
 *   <a href="https://pwanova.app/apps/{slug}"><img src="https://pwanova.app/api/badge/{slug}"></a>
 * with no tracking JavaScript required (the iframe embed at /embed/app/[slug] is the JS-optional
 * alternative when a partner would rather host the click target themselves).
 * Suspended/hidden/pending apps 404, same as the JSON API and the iframe embed.
 */
const CORS = { "access-control-allow-origin": "*" }

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const dark = req.nextUrl.searchParams.get("theme") === "dark"
  if (!(await rateLimit(`badge:${await clientIp()}`, 120, 60))) {
    return new NextResponse(badgeNotFoundSvg(dark), { status: 429, headers: { ...CORS, "content-type": "image/svg+xml", "cache-control": "no-store" } })
  }
  // `_example` is the Partner Kit's static, clearly-fictional sample (see src/lib/partner-example.ts)
  const app = isExampleSlug(slug) ? exampleApp : await getAppBySlug(slug)
  if (!app || app.status !== "published") {
    return new NextResponse(badgeNotFoundSvg(dark), { status: 404, headers: { ...CORS, "content-type": "image/svg+xml", "cache-control": "no-store" } })
  }
  const body = badgeSvg({
    title: app.ratingsCount ? `${app.rating.toFixed(1)} ★ · ${app.ratingsCount} ratings` : "View on PWANova",
    subtitle: app.name,
    verified: app.verificationStatus === "verified",
    demo: app.isDemo,
    dark,
  })
  return new NextResponse(body, { headers: { ...CORS, "content-type": "image/svg+xml", "cache-control": "no-store" } })
}
