import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/env"
import { mapCatalogApp } from "./catalog"
import type { RequirementResult } from "@/lib/v2/matching"
import type { CatalogApp } from "@/lib/v2/types"

/** A request as everybody who may see it sees it: requirements only, never the person. */
export interface BuyerRequest {
  uuid: string
  id: string
  title: string
  problem: string
  teamSize: string | null
  countryCode: string | null
  languages: string[]
  budgetMaxCents: number | null
  budgetCurrency: string
  budgetPerUser: boolean
  budgetInterval: string | null
  categorySlugs: string[]
  useCaseSlugs: string[]
  requiredFacts: string[]
  requiredIntegrations: string[]
  requiredPlatforms: string[]
  mustHave: string[]
  niceToHave: string[]
  timeframe: string | null
  visibility: "public" | "private"
  status: "open" | "matched" | "closed" | "hidden"
  createdAt: string
  ownerId: string
}

const COLUMNS = "id, public_id, title, problem, team_size, country_code, languages, budget_max_cents, budget_currency, budget_per_user, budget_interval, category_slugs, use_case_slugs, required_facts, required_integrations, required_platforms, must_have, nice_to_have, timeframe, visibility, status, created_at, user_id"
type Row = { id: string; public_id: string; title: string; problem: string; team_size: string | null; country_code: string | null; languages: string[]; budget_max_cents: number | null; budget_currency: string; budget_per_user: boolean; budget_interval: string | null; category_slugs: string[]; use_case_slugs: string[]; required_facts: string[]; required_integrations: string[]; required_platforms: string[]; must_have: string[]; nice_to_have: string[]; timeframe: string | null; visibility: string; status: string; created_at: string; user_id: string }

const map = (r: Row): BuyerRequest => ({
  uuid: r.id, id: r.public_id, title: r.title, problem: r.problem, teamSize: r.team_size, countryCode: r.country_code, languages: r.languages,
  budgetMaxCents: r.budget_max_cents, budgetCurrency: r.budget_currency, budgetPerUser: r.budget_per_user, budgetInterval: r.budget_interval,
  categorySlugs: r.category_slugs, useCaseSlugs: r.use_case_slugs, requiredFacts: r.required_facts, requiredIntegrations: r.required_integrations,
  requiredPlatforms: r.required_platforms, mustHave: r.must_have, niceToHave: r.nice_to_have, timeframe: r.timeframe,
  visibility: r.visibility as BuyerRequest["visibility"], status: r.status as BuyerRequest["status"], createdAt: r.created_at, ownerId: r.user_id,
})

export async function getPublicRequests(limit = 30): Promise<BuyerRequest[]> {
  if (!isSupabaseConfigured) return []
  const sb = await createClient()
  const { data } = await sb.from("buyer_requests").select(COLUMNS).eq("visibility", "public").in("status", ["open", "matched"]).order("created_at", { ascending: false }).limit(limit)
  return (data ?? []).map(map)
}

export async function getMyRequests(userId: string): Promise<BuyerRequest[]> {
  if (!isSupabaseConfigured) return []
  const sb = await createClient()
  const { data } = await sb.from("buyer_requests").select(COLUMNS).eq("user_id", userId).order("created_at", { ascending: false }).limit(50)
  return (data ?? []).map(map)
}

/** Row level security decides: the buyer, a matched verified vendor, a moderator, or anybody when the request is public. */
export async function getRequest(publicId: string): Promise<BuyerRequest | null> {
  if (!isSupabaseConfigured || !/^[a-z0-9]{6,20}$/.test(publicId)) return null
  const sb = await createClient()
  const { data } = await sb.from("buyer_requests").select(COLUMNS).eq("public_id", publicId).maybeSingle()
  return data ? map(data) : null
}

export interface RequestMatch { rank: number; score: number; met: number; total: number; requirements: RequirementResult[]; app: CatalogApp }
export async function getRequestMatches(requestUuid: string): Promise<RequestMatch[]> {
  if (!isSupabaseConfigured) return []
  const sb = await createClient()
  const { data } = await sb.from("buyer_request_matches").select("app_id, rank, score, reasons").eq("request_id", requestUuid).order("rank")
  const rows = data ?? []
  if (!rows.length) return []
  const { data: apps } = await sb.from("catalog_apps").select("*").in("id", rows.map((r) => r.app_id))
  const byId = new Map((apps ?? []).map((a) => [a.id, mapCatalogApp(a)]))
  return rows.flatMap((r) => {
    const app = byId.get(r.app_id)
    const reasons = (r.reasons ?? {}) as { met?: number; total?: number; requirements?: RequirementResult[] }
    return app ? [{ rank: r.rank, score: r.score, met: reasons.met ?? 0, total: reasons.total ?? 0, requirements: reasons.requirements ?? [], app }] : []
  })
}

export interface RequestResponse {
  id: string; status: "interested" | "withdrawn" | "declined" | "contact_shared"; message: string | null; createdAt: string
  app: { id: string; slug: string; name: string; iconUrl: string | null }
  consent: { sharedFields: string[]; grantedAt: string; revokedAt: string | null } | null
}
/** For the buyer: who is interested, and what was shared with whom. */
export async function getRequestResponses(requestUuid: string): Promise<RequestResponse[]> {
  if (!isSupabaseConfigured) return []
  const sb = await createClient()
  const [{ data: responses }, { data: consents }] = await Promise.all([
    sb.from("buyer_request_responses").select("id, status, message, created_at, app:apps(id, slug, name, icon_url)").eq("request_id", requestUuid).order("created_at", { ascending: false }),
    sb.from("buyer_contact_consents").select("response_id, shared_fields, granted_at, revoked_at").eq("request_id", requestUuid),
  ])
  return (responses ?? []).flatMap((r) => {
    const app = Array.isArray(r.app) ? r.app[0] : r.app
    if (!app) return []
    const c = (consents ?? []).find((x) => x.response_id === r.id)
    return [{
      id: r.id, status: r.status as RequestResponse["status"], message: r.message, createdAt: r.created_at,
      app: { id: app.id, slug: app.slug, name: app.name, iconUrl: app.icon_url },
      consent: c ? { sharedFields: c.shared_fields, grantedAt: c.granted_at, revokedAt: c.revoked_at } : null,
    }]
  })
}

export interface RequestContact { contact_name: string | null; contact_email: string | null; company_name: string | null; phone: string | null; note: string | null }
/** The buyer's own contact details. No policy lets anybody else read this table. */
export async function getRequestContact(requestUuid: string): Promise<RequestContact | null> {
  if (!isSupabaseConfigured) return null
  const sb = await createClient()
  const { data } = await sb.from("buyer_request_contacts").select("contact_name, contact_email, company_name, phone, note").eq("request_id", requestUuid).maybeSingle()
  return data
}

export interface VendorRequest {
  request: BuyerRequest
  app: { id: string; slug: string; name: string }
  rank: number
  met: number
  total: number
  response: { id: string; status: RequestResponse["status"]; message: string | null } | null
  /** Only what the buyer chose to share, and only while their consent stands. */
  contact: Record<string, string> | null
}
/** For a vendor: requests matched to their verified listings. Requirements, never the person. */
export async function getVendorRequests(userId: string): Promise<VendorRequest[]> {
  if (!isSupabaseConfigured) return []
  const sb = await createClient()
  const { data: apps } = await sb.from("apps").select("id, slug, name").eq("developer_id", userId).eq("ownership_status", "verified_owner")
  if (!apps?.length) return []
  const { data: matches } = await sb.from("buyer_request_matches").select("request_id, app_id, rank, reasons").in("app_id", apps.map((a) => a.id)).order("created_at", { ascending: false }).limit(100)
  if (!matches?.length) return []
  const requestIds = [...new Set(matches.map((m) => m.request_id))]
  const [{ data: requests }, { data: responses }] = await Promise.all([
    sb.from("buyer_requests").select(COLUMNS).in("id", requestIds).in("status", ["open", "matched"]),
    sb.from("buyer_request_responses").select("id, request_id, app_id, status, message").eq("vendor_user_id", userId).in("request_id", requestIds),
  ])
  const out: VendorRequest[] = []
  for (const m of matches) {
    const request = (requests ?? []).find((r) => r.id === m.request_id)
    const app = apps.find((a) => a.id === m.app_id)
    if (!request || !app || request.user_id === userId) continue
    const response = (responses ?? []).find((r) => r.request_id === m.request_id && r.app_id === m.app_id) ?? null
    let contact: Record<string, string> | null = null
    if (response?.status === "contact_shared") {
      const { data } = await sb.rpc("shared_contact", { p_response_id: response.id })
      if (data && typeof data === "object" && !Array.isArray(data)) {
        contact = Object.fromEntries(Object.entries(data).filter(([, v]) => typeof v === "string" && v).map(([k, v]) => [k, String(v)]))
      }
    }
    const reasons = (m.reasons ?? {}) as { met?: number; total?: number }
    out.push({
      request: map(request), app, rank: m.rank, met: reasons.met ?? 0, total: reasons.total ?? 0,
      response: response ? { id: response.id, status: response.status as RequestResponse["status"], message: response.message } : null, contact,
    })
  }
  return out
}
