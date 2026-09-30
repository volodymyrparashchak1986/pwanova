import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { isUnprefixedPath, legacyTarget, LOCALE_COOKIE, negotiateLocale, splitLocale } from "@/i18n/config"

/**
 * 1. Language: every page lives under /en or /de. A URL without a language is sent to the visitor's
 *    language (a choice they made earlier, then Accept-Language); v1 URLs are sent to where they live now.
 * 2. Refresh the Supabase session cookie.
 *
 * Nothing is stored on the visitor's device here except the session of a signed-in person. The language
 * cookie is written only when somebody picks a language; partner attribution travels in the address.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // A sign-in link that was not sent back to /auth/callback arrives on the start page with its code.
  // The code belongs to the callback, which completes the sign-in.
  if (request.nextUrl.searchParams.has("code") && (pathname === "/" || splitLocale(pathname).path === "/") && !request.nextUrl.searchParams.has("q")) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/callback"
    return NextResponse.redirect(url, 307)
  }

  if (!isUnprefixedPath(pathname)) {
    const { locale, path } = splitLocale(pathname)
    const moved = legacyTarget(path)
    if (!locale || moved) {
      const url = request.nextUrl.clone()
      const target = locale ?? negotiateLocale(request.headers.get("accept-language"), request.cookies.get(LOCALE_COOKIE)?.value)
      const next = moved?.path ?? path
      url.pathname = next === "/" ? `/${target}` : `/${target}${next}`
      for (const [k, v] of Object.entries(moved?.query ?? {})) if (!url.searchParams.has(k)) url.searchParams.set(k, v)
      // A moved page is permanent; the choice of language depends on the visitor, so it is not.
      return NextResponse.redirect(url, locale ? 308 : 307)
    }
  }

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
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)"],
}
