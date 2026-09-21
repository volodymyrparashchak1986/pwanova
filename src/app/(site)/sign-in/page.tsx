import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { LogoMark } from "@/components/layout/logo"
import { SignInForm } from "@/components/auth/sign-in-form"
import { getViewer } from "@/lib/data"
import { isSupabaseConfigured } from "@/lib/env"
import { safeNext } from "@/lib/safe-next"

export const metadata: Metadata = { title: "Sign in", robots: { index: false } }

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams
  const next = safeNext(sp.next)
  if (await getViewer()) redirect(next)
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col px-4 py-14 md:py-24">
      <LogoMark className="mx-auto size-14" />
      <h1 className="mt-6 text-center text-3xl font-semibold tracking-tight">Sign in to PWANova</h1>
      <p className="mt-2 mb-8 text-center text-muted-foreground">Rate apps, write reviews, save favorites and ship your own.</p>
      {sp.error && <p role="alert" className="mb-4 rounded-xl bg-destructive/10 p-3 text-center text-sm text-destructive">Sign-in failed. Please try again.</p>}
      {isSupabaseConfigured
        ? <SignInForm next={next} />
        : <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Authentication needs a Supabase project. Add your credentials to <code>.env.local</code> (see README) to enable Google, GitHub and magic-link sign-in.</p>}
    </div>
  )
}
