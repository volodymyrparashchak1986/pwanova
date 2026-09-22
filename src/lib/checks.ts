import "server-only"
import { analyzeUrl, type AnalysisResult } from "@/lib/analyzer"
import { createAdminClient } from "@/lib/supabase/admin"

/** Ownership and technical observations are independent; never a security certificate. */
export function qualifiesForVerified(_a: AnalysisResult, ownershipVerified: boolean) {
  return ownershipVerified
}

export function healthFrom(a: AnalysisResult): "online" | "degraded" | "offline" {
  if (!a.checks.reachable) return "offline"
  return (a.checks.response_ms ?? 0) > 3000 || (a.checks.status_code ?? 200) >= 500 ? "degraded" : "online"
}

/** Re-run analysis for an app and persist results. Service role only (clients cannot write checks). */
export async function runAppChecks(appId: string): Promise<{ ok: boolean; error?: string; verified?: boolean }> {
  const admin = createAdminClient()
  if (!admin) return { ok: false, error: "Server checks need SUPABASE_SERVICE_ROLE_KEY." }
  const { data: app } = await admin.from("apps").select("id, url, ownership_status").eq("id", appId).maybeSingle()
  if (!app) return { ok: false, error: "App not found." }

  const a = await analyzeUrl(app.url)
  const { data: recorded, error } = await admin.rpc("record_app_checks", {
    p_app_id: appId, p_url: app.url, p_checks: a.checks,
    p_details: { method: "bounded_http_fetch", notes: a.notes, evidence: {
      reachable: `HTTP ${a.checks.status_code ?? "unavailable"}`,
      https: a.checks.https_ok === null ? "Connection not established" : "TLS observation; not a security audit",
      manifest: a.manifestUrl ?? "No manifest link detected",
      browserCapabilities: "Unknown: no browser execution performed",
    } },
  })
  if (error || !recorded) return { ok: false, error: "Check could not be saved; the app URL may have changed." }
  return { ok: true, verified: app.ownership_status === "verified_owner" }
}
