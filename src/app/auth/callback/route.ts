import { NextResponse, type NextRequest } from "next/server"
import { isLocale, LOCALE_COOKIE } from "@/i18n/config"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/env"
import { NEXT_COOKIE, safeNext } from "@/lib/safe-next"

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const remembered = req.cookies.get(NEXT_COOKIE)?.value
  const next = safeNext(searchParams.get("next") ?? (remembered ? decodeURIComponent(remembered) : null))
  const code = searchParams.get("code")
  if (isSupabaseConfigured && code) {
    const sb = await createClient()
    const { data, error } = await sb.auth.exchangeCodeForSession(code)
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`)
      response.cookies.delete(NEXT_COOKIE)
      // the language somebody chose in their profile applies to addresses without a language
      const { data: profile } = data.user ? await sb.from("profiles").select("locale").eq("id", data.user.id).maybeSingle() : { data: null }
      if (isLocale(profile?.locale)) response.cookies.set(LOCALE_COOKIE, profile.locale, { maxAge: 60 * 60 * 24 * 365, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" })
      return response
    }
  }
  const response = NextResponse.redirect(`${origin}/sign-in?error=auth&next=${encodeURIComponent(next)}`)
  response.cookies.delete(NEXT_COOKIE)
  return response
}
