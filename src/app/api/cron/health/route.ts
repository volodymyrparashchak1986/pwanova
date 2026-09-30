import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { runAppChecks } from "@/lib/checks"
import { verifyDueApps } from "@/lib/v2/verify/engine"

export const maxDuration = 60

/**
 * Daily maintenance (Vercel Cron, protected by CRON_SECRET):
 *  1. health checks for the ten listings that were checked longest ago;
 *  2. verification runs for listings that are due, within the daily budget and the time that is left;
 *  3. retention: raw events older than 180 days are removed.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: "No service role key" }, { status: 500 })
  const started = Date.now()

  const { data: apps } = await admin.from("apps").select("id").eq("status", "published").eq("is_demo", false).order("health_checked_at", { ascending: true, nullsFirst: true }).limit(10)
  const results = await Promise.allSettled((apps ?? []).map((a) => runAppChecks(a.id)))

  const { data: purged, error: purgeError } = await admin.rpc("purge_old_events", { p_days: 180 })
  if (purgeError) console.error("cron/health: purge_old_events failed", purgeError.message)

  const verification = await verifyDueApps({ limit: 10, deadlineMs: Math.max(0, 52_000 - (Date.now() - started)) })

  return NextResponse.json({ checked: results.length, eventsPurged: purgeError ? null : purged, verification })
}
