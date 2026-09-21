import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/env"

export async function POST(req: NextRequest) {
  if (isSupabaseConfigured) {
    const sb = await createClient()
    await sb.auth.signOut()
  }
  return NextResponse.redirect(new URL("/", req.nextUrl.origin), { status: 303 })
}
