import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import type { EventType } from "@/lib/constants"

/**
 * Event ingestion runs with the service role so anonymous visitors can never write
 * to app_events directly (there is no public insert policy). No-op without credentials.
 */
export async function recordEvent(input: {
  appId: string
  type: EventType
  userId?: string | null
  source?: string
  partnerId?: string | null
  metadata?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  if (!admin) return
  const { data: app } = await admin.from("apps").select("status,is_demo").eq("id", input.appId).maybeSingle()
  if (!app || app.status !== "published" || app.is_demo) return
  if (input.partnerId) {
    const { data: partner } = await admin.from("partners").select("id").eq("id", input.partnerId).eq("status", "active").eq("is_demo", false).maybeSingle()
    if (!partner) input.partnerId = null
  }
  await admin.from("app_events").insert({
    app_id: input.appId,
    user_id: input.userId ?? null,
    event_type: input.type,
    source: input.source ?? "direct",
    partner_id: input.partnerId ?? null,
    metadata: input.metadata ?? {},
  })
}
