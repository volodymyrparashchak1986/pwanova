import "server-only"
import { createHash } from "node:crypto"
import { headers } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"

const memory = new Map<string, { count: number; reset: number }>()

/**
 * Returns true when the action is allowed.
 * Uses the shared DB counter when a service role key exists, otherwise a development-only in-memory counter. Production fails closed.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const admin = createAdminClient()
  if (admin) {
    const { data, error } = await admin.rpc("check_rate_limit", { p_key: key, p_max: max, p_window_seconds: windowSeconds })
    if (!error && typeof data === "boolean") return data
  }
  if (process.env.NODE_ENV === "production") return false // fail closed; no process-local production limits
  const now = Date.now()
  const entry = memory.get(key)
  if (!entry || entry.reset < now) {
    memory.set(key, { count: 1, reset: now + windowSeconds * 1000 })
    if (memory.size > 5000) for (const [k, v] of memory) if (v.reset < now) memory.delete(k)
    return true
  }
  entry.count++
  return entry.count <= max
}

export async function clientIp(): Promise<string> {
  const h = await headers()
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim()
  return createHash("sha256").update(`${process.env.SUPABASE_SERVICE_ROLE_KEY ?? "local"}:${new Date().toISOString().slice(0,10)}:${ip}`).digest("hex")
}
