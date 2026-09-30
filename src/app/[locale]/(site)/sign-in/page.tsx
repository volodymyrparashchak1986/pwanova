import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { SignInForm } from "@/components/auth/sign-in-form"
import { Link } from "@/components/i18n/link"
import { LogoMark } from "@/components/layout/logo"
import { isLocale } from "@/i18n/config"
import { getDictionary, getI18n } from "@/i18n/server"
import { getViewer } from "@/lib/data"
import { isSupabaseConfigured } from "@/lib/env"
import { safeNext } from "@/lib/safe-next"
import { privateMetadata } from "@/lib/seo"

export async function generateMetadata({ params }: PageProps<"/[locale]/sign-in">): Promise<Metadata> {
  const { locale } = await params
  return privateMetadata(isLocale(locale) ? getDictionary(locale).common.signIn : "Sign in")
}

export default async function SignInPage({ searchParams }: PageProps<"/[locale]/sign-in">) {
  const [sp, { t, href }] = await Promise.all([searchParams, getI18n()])
  // only a path on this site is accepted as the place to return to
  const next = safeNext(typeof sp.next === "string" ? sp.next : null, href("/"))
  if (await getViewer()) redirect(next)
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col px-4 py-14 md:py-24">
      <LogoMark className="mx-auto size-14" />
      <h1 className="mt-6 text-center text-3xl font-semibold tracking-tight">{t.auth.title}</h1>
      <p className="mt-2 mb-8 text-center text-muted-foreground">{t.auth.body}</p>
      {sp.error && <p role="alert" className="mb-4 rounded-xl bg-destructive/10 p-3 text-center text-sm text-destructive">{t.auth.error}</p>}
      {isSupabaseConfigured
        ? <SignInForm next={next} />
        : <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">{t.auth.needsDatabase}</p>}
      <p className="mt-6 text-center text-xs text-muted-foreground">
        {t.auth.terms} <Link href="/legal/terms" className="underline">{t.footer.links.terms}</Link> · <Link href="/legal/privacy" className="underline">{t.footer.links.privacy}</Link>
      </p>
    </div>
  )
}
