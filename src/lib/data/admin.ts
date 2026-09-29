import { createClient } from "@/lib/supabase/server"
import { mapEvidence } from "./catalog"
import type { EvidenceItem } from "@/lib/v2/types"

/**
 * Reads for the admin area. Everything goes through the staff member's own session: row level security
 * decides what a moderator or an admin may see. Contact details of buyers are not readable here at all.
 */
type One<T> = T | T[] | null
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v)

export interface AdminApp { id: string; slug: string; name: string; domain: string; status: string; ownershipStatus: string; verificationState: string; evidenceScore: number; isFeatured: boolean; isDemo: boolean; moderationNote: string | null; duplicateOf: string | null; createdAt: string; owner: string | null }
export async function getAdminApps(limit = 300): Promise<AdminApp[]> {
  const sb = await createClient()
  const { data } = await sb.from("apps")
    .select("id, slug, name, domain, status, ownership_status, verification_state, evidence_score, is_featured, is_demo, moderation_note, duplicate_of, created_at, owner:profiles!apps_developer_id_fkey(username)")
    .order("created_at", { ascending: false }).limit(limit)
  return (data ?? []).map((a) => ({
    id: a.id, slug: a.slug, name: a.name, domain: a.domain, status: a.status, ownershipStatus: a.ownership_status, verificationState: a.verification_state, evidenceScore: a.evidence_score,
    isFeatured: a.is_featured, isDemo: a.is_demo, moderationNote: a.moderation_note, duplicateOf: a.duplicate_of, createdAt: a.created_at, owner: one(a.owner as One<{ username: string }>)?.username ?? null,
  }))
}

export interface AdminReport { id: string; reason: string; details: string | null; status: string; createdAt: string; app: { id: string; name: string; slug: string } | null; review: { id: string; body: string } | null; evidence: { id: string; key: string; appId: string } | null; launchId: string | null; requestId: string | null }
export async function getAdminReports(): Promise<AdminReport[]> {
  const sb = await createClient()
  const { data } = await sb.from("reports")
    .select("id, reason, details, status, created_at, launch_id, request_id, app:apps(id, name, slug), review:reviews(id, body), evidence:app_evidence(id, attribute_key, app_id)")
    .in("status", ["open", "reviewing"]).order("created_at", { ascending: false }).limit(100)
  return (data ?? []).map((r) => {
    const e = one(r.evidence as One<{ id: string; attribute_key: string; app_id: string }>)
    return {
      id: r.id, reason: r.reason, details: r.details, status: r.status, createdAt: r.created_at, launchId: r.launch_id, requestId: r.request_id,
      app: one(r.app as One<{ id: string; name: string; slug: string }>), review: one(r.review as One<{ id: string; body: string }>),
      evidence: e ? { id: e.id, key: e.attribute_key, appId: e.app_id } : null,
    }
  })
}

export interface PendingEvidence extends EvidenceItem { app: { id: string; name: string; slug: string } | null; submitter: string | null }
export async function getPendingEvidence(): Promise<PendingEvidence[]> {
  const sb = await createClient()
  const { data } = await sb.from("app_evidence").select("*, app:apps(id, name, slug), submitter:profiles!app_evidence_submitted_by_fkey(username)")
    .eq("status", "pending_review").order("collected_at", { ascending: true }).limit(100)
  return (data ?? []).map((e) => ({ ...mapEvidence(e), app: one(e.app as One<{ id: string; name: string; slug: string }>), submitter: one(e.submitter as One<{ username: string }>)?.username ?? null }))
}

export interface AdminLaunch { id: string; slug: string; headline: string; description: string | null; status: string; launchDate: string; createdAt: string; app: { name: string; slug: string } | null }
export async function getAdminLaunches(): Promise<AdminLaunch[]> {
  const sb = await createClient()
  const { data } = await sb.from("launches").select("id, slug, headline, description, status, launch_date, created_at, app:apps(name, slug)").in("status", ["pending", "approved"]).order("created_at", { ascending: false }).limit(60)
  return (data ?? []).map((l) => ({ id: l.id, slug: l.slug, headline: l.headline, description: l.description, status: l.status, launchDate: l.launch_date, createdAt: l.created_at, app: one(l.app as One<{ name: string; slug: string }>) }))
}

export interface AdminRequest { id: string; publicId: string; title: string; problem: string; status: string; visibility: string; createdAt: string; moderationNote: string | null }
export async function getAdminRequests(): Promise<AdminRequest[]> {
  const sb = await createClient()
  const { data } = await sb.from("buyer_requests").select("id, public_id, title, problem, status, visibility, created_at, moderation_note").order("created_at", { ascending: false }).limit(100)
  return (data ?? []).map((r) => ({ id: r.id, publicId: r.public_id, title: r.title, problem: r.problem, status: r.status, visibility: r.visibility, createdAt: r.created_at, moderationNote: r.moderation_note }))
}

export interface AdminEntitlement { id: string; plan: string; status: string; startsAt: string; endsAt: string | null; note: string | null; user: string | null; app: string | null }
export async function getAdminEntitlements(): Promise<AdminEntitlement[]> {
  const sb = await createClient()
  const { data } = await sb.from("entitlements").select("id, plan_slug, status, starts_at, ends_at, note, user:profiles!entitlements_user_id_fkey(username), app:apps(slug)").order("created_at", { ascending: false }).limit(100)
  return (data ?? []).map((e) => ({ id: e.id, plan: e.plan_slug, status: e.status, startsAt: e.starts_at, endsAt: e.ends_at, note: e.note, user: one(e.user as One<{ username: string }>)?.username ?? null, app: one(e.app as One<{ slug: string }>)?.slug ?? null }))
}

export interface AdminCampaign { id: string; sponsor: string; placement: string; status: string; startsAt: string; endsAt: string; app: string | null; category: string | null }
export async function getAdminCampaigns(): Promise<AdminCampaign[]> {
  const sb = await createClient()
  const { data } = await sb.from("sponsor_campaigns").select("id, sponsor_name, placement, status, starts_at, ends_at, app:apps(slug), category:categories(slug)").order("created_at", { ascending: false }).limit(50)
  return (data ?? []).map((c) => ({ id: c.id, sponsor: c.sponsor_name, placement: c.placement, status: c.status, startsAt: c.starts_at, endsAt: c.ends_at, app: one(c.app as One<{ slug: string }>)?.slug ?? null, category: one(c.category as One<{ slug: string }>)?.slug ?? null }))
}

export interface AuditEntry { id: string; action: string; targetType: string; reason: string | null; createdAt: string; actor: string | null; role: string | null; app: string | null; previous: unknown; next: unknown }
export async function getAuditLog(limit = 80): Promise<AuditEntry[]> {
  const sb = await createClient()
  const [v2, v1] = await Promise.all([
    sb.from("audit_logs").select("id, action, target_type, reason, created_at, actor_role, previous, next, actor:profiles!audit_logs_actor_id_fkey(username), app:apps(slug)").order("created_at", { ascending: false }).limit(limit),
    sb.from("admin_actions").select("id, action, target_type, reason, created_at, admin:profiles(username)").order("created_at", { ascending: false }).limit(limit),
  ])
  const rows: AuditEntry[] = [
    ...(v2.data ?? []).map((e) => ({ id: e.id, action: e.action, targetType: e.target_type, reason: e.reason, createdAt: e.created_at, role: e.actor_role, previous: e.previous, next: e.next, actor: one(e.actor as One<{ username: string }>)?.username ?? null, app: one(e.app as One<{ slug: string }>)?.slug ?? null })),
    ...(v1.data ?? []).map((e) => ({ id: e.id, action: e.action, targetType: e.target_type, reason: e.reason, createdAt: e.created_at, role: "admin", previous: null, next: null, actor: one(e.admin as One<{ username: string }>)?.username ?? null, app: null })),
  ]
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
}

export async function getAdminCounts() {
  const sb = await createClient()
  const head = { count: "exact" as const, head: true }
  const [apps, evidence, launches, reports] = await Promise.all([
    sb.from("apps").select("id", head).eq("status", "pending"),
    sb.from("app_evidence").select("id", head).eq("status", "pending_review"),
    sb.from("launches").select("id", head).eq("status", "pending"),
    sb.from("reports").select("id", head).in("status", ["open", "reviewing"]),
  ])
  return { apps: apps.count ?? 0, evidence: evidence.count ?? 0, launches: launches.count ?? 0, reports: reports.count ?? 0 }
}

export async function getNewsletterCount(): Promise<number> {
  const sb = await createClient()
  const { count } = await sb.from("newsletter_subscriptions").select("id", { count: "exact", head: true }).is("unsubscribed_at", null)
  return count ?? 0
}
