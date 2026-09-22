import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { runAppChecks } from "@/lib/checks"

export const maxDuration = 60

/** Periodic app health / quality checks. Wire to Vercel Cron; protected by CRON_SECRET. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: "No service role key" }, { status: 500 })
  const { data: apps } = await admin.from("apps").select("id").eq("status", "published").eq("is_demo", false).order("health_checked_at", { ascending: true, nullsFirst: true }).limit(10)
  const results = await Promise.allSettled((apps ?? []).map((a) => runAppChecks(a.id)))

  // Raw event retention: this cron runs daily (see vercel.json), which is a fine cadence for a 180-day window.
  const { data: purged, error: purgeError } = await admin.rpc("purge_old_events", { p_days: 180 })
  if (purgeError) console.error("cron/health: purge_old_events failed", purgeError.message)

  return NextResponse.json({ checked: results.length, eventsPurged: purgeError ? null : purged })
}
