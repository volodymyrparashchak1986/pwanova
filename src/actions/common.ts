import "server-only"
import type { User } from "@supabase/supabase-js"
import { msg } from "./messages"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/env"
import { rateLimit } from "@/lib/security/rate-limit"
import type { ActionResult } from "@/lib/types"

export const fail = (error: string): ActionResult<never> => ({ ok: false, error })

/** Resolves the signed-in user and a session-bound client (RLS applies), applying a per-user rate limit. */
type Client = Awaited<ReturnType<typeof createClient>>
type Authed = { ok: true; sb: Client; user: User } | { ok: false; error: string }

export async function authed(action: string, limit?: { max: number; windowSeconds: number }): Promise<Authed> {
  if (!isSupabaseConfigured) return { ok: false, error: await msg("needsDatabase") }
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { ok: false, error: await msg("signIn") }
  if (limit && !(await rateLimit(`${action}:${user.id}`, limit.max, limit.windowSeconds))) {
    return { ok: false, error: await msg("tooFast") }
  }
  return { ok: true, sb, user }
}

export async function appMeta(sb: Client, appId: string) {
  const { data } = await sb.from("apps").select("id, slug, developer_id, ownership_status, url, domain, name").eq("id", appId).maybeSingle()
  return data
}

/**
 * Creates a company under a free slug and returns its id. A company that is not public yet is
 * invisible to everybody but its author, so the database says whether a slug is taken.
 */
export async function createCompany(sb: Client, base: string, row: { name: string; country_code: string | null; website?: string | null; created_by: string }): Promise<string | null> {
  const suffix = () => Math.random().toString(36).slice(2, 6)
  for (const slug of [base, `${base}-${suffix()}`, `${base}-${suffix()}`]) {
    const { data, error } = await sb.from("companies").insert({ ...row, slug }).select("id").single()
    if (data) return data.id
    if (error?.code !== "23505") return null // anything but "slug taken" is not solved by another slug
  }
  return null
}

/** The caller's role, read from the database on every privileged action. The client is never asked. */
export async function roleOf(sb: Client, userId: string): Promise<string> {
  const { data } = await sb.from("profiles").select("role").eq("id", userId).maybeSingle()
  return data?.role ?? "user"
}

/** Whether a site feature is switched on (site_settings.features). Defaults to on when the row is missing. */
export async function featureOn(sb: Client, feature: string): Promise<boolean> {
  const { data } = await sb.from("site_settings").select("value").eq("key", "features").maybeSingle()
  const value = (data?.value ?? {}) as Record<string, unknown>
  return value[feature] !== false
}
