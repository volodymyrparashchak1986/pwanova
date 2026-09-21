import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { recordEvent } from "@/lib/events"
import { clientIp, rateLimit } from "@/lib/security/rate-limit"
import { classifyTraffic } from "@/lib/traffic"
import { isSupabaseConfigured, siteUrl } from "@/lib/env"
import { PARTNER_COOKIE } from "@/lib/constants"

const CLIENT_EVENTS = ["view", "open_app", "install_click", "install_instruction_view", "share"] as const
const schema = z.object({
  appId: z.string().uuid(),
  type: z.enum(CLIENT_EVENTS),
  from: z.string().max(20).nullish(),
  referrer: z.string().max(500).nullish(),
})

/**
 * Event ingestion. Note: `install_click` is an install *intent* (a click on Install),
 * not a confirmed installation. Never present it as installs.
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured) return new NextResponse(null, { status: 204 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid event" }, { status: 400 })
  if (!(await rateLimit(`events:${await clientIp()}`, 120, 60))) return NextResponse.json({ error: "Rate limited" }, { status: 429 })

  const ref = req.cookies.get(PARTNER_COOKIE)?.value
  let partnerId: string | null = null
  if (ref) {
    const admin = createAdminClient()
    const { data } = await admin?.from("partners").select("id").or(`slug.eq.${ref.replace(/[^a-z0-9_-]/g, "")},referral_code.eq.${ref.replace(/[^a-z0-9_-]/g, "")}`).limit(1).maybeSingle() ?? { data: null }
    partnerId = data?.id ?? null
  }
  const source = classifyTraffic({ from: parsed.data.from, referrer: parsed.data.referrer, hasPartner: Boolean(partnerId), siteHost: new URL(siteUrl).hostname })
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  await recordEvent({ appId: parsed.data.appId, type: parsed.data.type, userId: user?.id, source, partnerId })
  return new NextResponse(null, { status: 204 })
}
