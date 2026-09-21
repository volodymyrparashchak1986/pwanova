import "server-only"
import { createClient } from "@supabase/supabase-js"
import { supabaseUrl } from "@/lib/env"

/**
 * Service-role client. BYPASSES RLS. Server-only (enforced by `server-only`).
 * Use exclusively for work the visitor must not be able to fake:
 * event ingestion, ownership verification results, quality checks, rate limits.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !key) return null
  return createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
