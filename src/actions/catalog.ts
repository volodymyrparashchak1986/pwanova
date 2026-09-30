"use server"

import { z } from "zod"
import { isSupabaseConfigured, showDemoData } from "@/lib/env"
import { clientIp, rateLimit } from "@/lib/security/rate-limit"
import { createClient } from "@/lib/supabase/server"
import { asJson } from "@/lib/supabase/rpc"

export interface AppSuggestion { id: string; slug: string; name: string; tagline: string; iconUrl: string | null }

/** Name search for pickers (comparison, alternatives). Public data only, a handful of rows, rate limited per visitor. */
export async function suggestApps(query: string): Promise<AppSuggestion[]> {
  const q = z.string().trim().min(2).max(60).safeParse(query)
  if (!q.success || !isSupabaseConfigured) return []
  if (!(await rateLimit(`suggest:${await clientIp()}`, 60, 60))) return []
  const sb = await createClient()
  const { data: ranked } = await sb.rpc("search_catalog", { p_query: q.data, p_filters: asJson(showDemoData ? { demo: true } : {}), p_sort: "relevance", p_limit: 6, p_offset: 0 })
  const ids = (ranked ?? []).map((r) => r.app_id)
  if (!ids.length) return []
  const { data } = await sb.from("catalog_apps").select("id, slug, name, tagline, icon_url").in("id", ids)
  const byId = new Map((data ?? []).map((r) => [r.id, r]))
  return ids.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => Boolean(r?.id && r.slug && r.name))
    .map((r) => ({ id: r.id!, slug: r.slug!, name: r.name!, tagline: r.tagline ?? "", iconUrl: r.icon_url }))
}
