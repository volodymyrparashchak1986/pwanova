import { NextResponse, type NextRequest } from "next/server"
import { verifyDueApps } from "@/lib/v2/verify/engine"

export const maxDuration = 60

/**
 * Verification only, for an extra scheduler run when the catalogue grows. Same secret as the daily job.
 * It is not registered in vercel.json: the daily job already verifies within its budget.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const limit = Math.min(10, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 5))
  return NextResponse.json(await verifyDueApps({ limit, deadlineMs: 52_000 }))
}
