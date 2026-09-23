import { NextRequest, NextResponse } from "next/server"
import { safeFetch } from "@/lib/security/ssrf"
import { clientIp, rateLimit } from "@/lib/security/rate-limit"

/** Raster-only proxy: external images use exactly the same SSRF and byte/time limits as metadata. */
export async function GET(req: NextRequest) {
  if (!(await rateLimit(`media:${await clientIp()}`, 120, 60))) return new NextResponse(null, { status: 429 })
  const url = req.nextUrl.searchParams.get("url")
  if (!url) return new NextResponse(null, { status: 400 })
  try {
    const image = await safeFetch(url, { maxBytes: 2_000_000, accept: "image/png,image/jpeg,image/webp,image/gif" })
    const type = image.headers.get("content-type")?.split(";")[0]
    if (image.status !== 200 || !type || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(type)) throw new Error("Unsupported image")
    return new NextResponse(new Uint8Array(image.bytes), { headers: { "content-type": type, "x-content-type-options": "nosniff", "cache-control": "no-store", "content-security-policy": "default-src 'none'; sandbox" } })
  } catch { return new NextResponse(null, { status: 404, headers: { "cache-control": "no-store" } }) }
}
