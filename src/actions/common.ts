import "server-only"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/env"
import { rateLimit } from "@/lib/security/rate-limit"
import type { ActionResult } from "@/lib/types"

export const fail = (error: string): ActionResult<never> => ({ ok: false, error })

export const DEMO_MESSAGE = "PWANova is running in demo mode. Connect Supabase (see README) to enable this."

/** Resolves the signed-in user and a session-bound client (RLS applies), applying a per-user rate limit. */
type Client = Awaited<ReturnType<typeof createClient>>
type Authed = { ok: true; sb: Client; user: User } | { ok: false; error: string }

export async function authed(action: string, limit?: { max: number; windowSeconds: number }): Promise<Authed> {
  if (!isSupabaseConfigured) return { ok: false, error: DEMO_MESSAGE }
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { ok: false, error: "Please sign in to continue." }
  if (limit && !(await rateLimit(`${action}:${user.id}`, limit.max, limit.windowSeconds))) {
    return { ok: false, error: "You're doing that too fast. Please try again in a bit." }
  }
  return { ok: true, sb, user }
}

export async function appMeta(sb: Awaited<ReturnType<typeof createClient>>, appId: string) {
  const { data } = await sb.from("apps").select("id, slug, developer_id, ownership_status, url, domain, name").eq("id", appId).maybeSingle()
  return data
}
