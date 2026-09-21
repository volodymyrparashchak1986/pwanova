import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/env"
import { safeNext } from "@/lib/safe-next"

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const next = safeNext(searchParams.get("next"))
  const code = searchParams.get("code")
  if (isSupabaseConfigured && code) {
    const sb = await createClient()
    const { error } = await sb.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }
  return NextResponse.redirect(`${origin}/sign-in?error=auth`)
}
