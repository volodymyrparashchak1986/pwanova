import "server-only"
import { analyzeUrl, type AnalysisResult } from "@/lib/analyzer"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * PWANova Verified = verified domain ownership AND a passing basic quality check:
 * reachable, valid HTTPS, security basics, web-app metadata, responsive + mobile-ready.
 */
export function qualifiesForVerified(a: AnalysisResult, ownershipVerified: boolean) {
  const c = a.checks
  const metadata = c.manifest_ok || Boolean(a.title)
  return ownershipVerified && c.reachable && c.https_ok && c.security_ok && metadata && c.responsive && c.mobile_optimized
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
  const now = new Date().toISOString()
  await admin.from("app_checks").upsert({ app_id: appId, ...a.checks, details: { notes: a.notes, hostSignal: a.hostSignal }, last_checked_at: now }, { onConflict: "app_id" })

  const owner = app.ownership_status === "verified_owner"
  const verified = qualifiesForVerified(a, owner)
  await admin.from("apps").update({
    is_pwa: a.isPwa,
    is_installable: a.isInstallable,
    health_status: healthFrom(a),
    health_checked_at: now,
    verification_status: verified ? "verified" : owner ? "failed" : "unverified",
  }).eq("id", appId)
  return { ok: true, verified }
}
