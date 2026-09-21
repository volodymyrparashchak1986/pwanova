import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { PARTNER_COOKIE } from "@/lib/constants"

const PARTNER_PARAMS = ["ref", "source", "utm_source"]

/**
 * 1. Refresh the Supabase session cookie.
 * 2. Remember partner attribution (?ref= / ?source=) for 30 days.
 *    This never overwrites an app's launch_source; it feeds traffic_source / referral_partner.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    })
    await supabase.auth.getUser()
  }

  for (const param of PARTNER_PARAMS) {
    const raw = request.nextUrl.searchParams.get(param)
    if (raw && /^[a-z0-9_-]{2,40}$/i.test(raw)) {
      response.cookies.set(PARTNER_COOKIE, raw.toLowerCase(), {
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      })
      break
    }
  }
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|txt|xml)$).*)"],
}
