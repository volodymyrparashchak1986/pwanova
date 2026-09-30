import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { recordEvent } from "@/lib/events"
import { clientIp, rateLimit } from "@/lib/security/rate-limit"
import { classifyTraffic } from "@/lib/traffic"
import { isSupabaseConfigured, siteUrl } from "@/lib/env"
import { readJsonBody } from "@/lib/security/json-body"
import { isLocale } from "@/i18n/config"

const CLIENT_EVENTS = ["view", "open_app", "install_click", "install_instruction_view", "share", "compare_added", "launch_view"] as const
const schema = z.object({
  appId: z.string().uuid(),
  type: z.enum(CLIENT_EVENTS),
  from: z.string().max(20).nullish(),
  referrer: z.string().max(500).nullish(),
  locale: z.string().max(5).nullish(),
  ref: z.string().regex(/^[a-z0-9_-]{2,40}$/).nullish(),
})

/**
 * Event ingestion. Note: `install_click` is an install *intent* (a click on Install),
 * not a confirmed installation. Never present it as installs.
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured) return new NextResponse(null, { status: 204 })
  const origin = req.headers.get("origin")
  if (origin && origin !== new URL(siteUrl).origin) return NextResponse.json({ error: "Origin not allowed" }, { status: 403 })
  let body: unknown
  try { body = await readJsonBody(req) } catch { return NextResponse.json({ error: "Payload too large" }, { status: 413 }) }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid event" }, { status: 400 })
  if (!(await rateLimit(`events:${await clientIp()}`, 120, 60))) return NextResponse.json({ error: "Rate limited" }, { status: 429 })

  // One page view per visitor, app and half hour; one of every other action per 30 seconds. The key is a
  // salted hash of the address that changes every day, so nothing here identifies a person later.
  const window = parsed.data.type === "view" || parsed.data.type === "launch_view" ? 1800 : 30
  if (!(await rateLimit(`event-dedupe:${await clientIp()}:${parsed.data.appId}:${parsed.data.type}`, 1, window))) return new NextResponse(null, { status: 204 })
  const ref = parsed.data.ref
  let partnerId: string | null = null
  if (ref) {
    const admin = createAdminClient()
    const { data } = await admin?.from("partners").select("id").eq("status", "active").eq("is_demo", false).or(`slug.eq.${ref},referral_code.eq.${ref}`).limit(1).maybeSingle() ?? { data: null }
    partnerId = data?.id ?? null
  }
  const source = classifyTraffic({ from: parsed.data.from, referrer: parsed.data.referrer, hasPartner: Boolean(partnerId), siteHost: new URL(siteUrl).hostname })
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  // The language edition is the only thing kept about the visitor: it feeds "popular in the German edition".
  const locale = isLocale(parsed.data.locale) ? parsed.data.locale : null
  await recordEvent({ appId: parsed.data.appId, type: parsed.data.type, userId: user?.id, source, partnerId, metadata: locale ? { locale } : {} })
  return new NextResponse(null, { status: 204 })
}
