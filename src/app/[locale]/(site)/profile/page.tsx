import type { Metadata } from "next"
import { CornerDownRight, LayoutDashboard, LogOut, ShieldAlert } from "lucide-react"
import { ProfileForm } from "@/components/app/profile-form"
import { PageHeader, PageShell } from "@/components/app/section-header"
import { SignedOutCard } from "@/components/app/signed-out"
import { Stars } from "@/components/app/stars"
import { Link } from "@/components/i18n/link"
import { LocaleSwitcher } from "@/components/layout/locale-switcher"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { Button, buttonVariants } from "@/components/ui/button"
import { isLocale } from "@/i18n/config"
import { I18nScope } from "@/i18n/scope"
import { fmt, relativeTime } from "@/i18n/format"
import { getDictionary, getI18n } from "@/i18n/server"
import { getActivity, getViewer } from "@/lib/data"
import { getOwnProfile } from "@/lib/data/account"
import { privateMetadata } from "@/lib/seo"
import { cn } from "@/lib/utils"

export async function generateMetadata({ params }: PageProps<"/[locale]/profile">): Promise<Metadata> {
  const { locale } = await params
  return privateMetadata(isLocale(locale) ? getDictionary(locale).profile.title : "Profile")
}

export default async function ProfilePage() {
  const [{ t, locale }, viewer] = await Promise.all([getI18n(), getViewer()])
  const appearance = (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm">
      <span>{t.profile.appearance}</span><span className="flex items-center gap-2"><LocaleSwitcher full /><ThemeToggle /></span>
    </div>
  )
  if (!viewer) {
    return (
      <PageShell>
        <SignedOutCard title={t.profile.title} body={t.profile.signInBody} next="/profile" />
        <div className="mx-auto mt-6 max-w-md">{appearance}</div>
      </PageShell>
    )
  }
  const [profile, activity] = await Promise.all([getOwnProfile(viewer.id), getActivity(viewer.id)])
  const staff = viewer.role === "admin" || viewer.role === "moderator"
  return (
    <PageShell className="max-w-xl">
      <PageHeader title={t.profile.title}>
        <p className="mt-2 text-sm text-muted-foreground">{viewer.email} · <Link className="hover:underline" href={`/developers/${viewer.username}`}>@{viewer.username}</Link></p>
      </PageHeader>
      <I18nScope namespaces={["profile"]}><ProfileForm initial={{ displayName: profile?.displayName ?? viewer.displayName, bio: profile?.bio ?? "", website: profile?.website ?? "", locale: profile?.locale ?? "" }} /></I18nScope>
      <div className="mt-8 space-y-3">
        {appearance}
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}><LayoutDashboard className="size-4" />{t.nav.dashboard}</Link>
          {staff && <Link href="/admin" className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}><ShieldAlert className="size-4" />{t.nav.admin}</Link>}
          <form action="/auth/sign-out" method="post"><Button type="submit" variant="ghost" className="rounded-full text-muted-foreground"><LogOut className="size-4" />{t.profile.signOut}</Button></form>
        </div>
      </div>

      <section className="mt-12" aria-labelledby="reviews-h">
        <h2 id="reviews-h" className="text-xl font-semibold tracking-tight">{t.profile.yourReviews}</h2>
        {activity.reviews.length ? (
          <ul className="mt-4 space-y-3">
            {activity.reviews.map((r) => {
              const response = Array.isArray(r.response) ? r.response[0] : r.response
              return (
                <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <Link href={`/apps/${r.app?.slug}#reviews`} className="font-semibold hover:underline">{r.app?.name}</Link>
                    <span className="text-muted-foreground">{relativeTime(locale, r.created_at)}</span>
                  </p>
                  {typeof r.rating === "number" && <Stars value={r.rating} size={13} className="mt-2" label={fmt(t.common.starsOf, { value: r.rating })} />}
                  <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">{r.body}</p>
                  {response && <p className="mt-3 flex gap-1.5 rounded-xl bg-accent/60 p-3 text-sm"><CornerDownRight className="mt-0.5 size-4 shrink-0" aria-hidden /><span><strong>{t.profile.makerReplied}:</strong> {response.body}</span></p>}
                </li>
              )
            })}
          </ul>
        ) : <p className="mt-3 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">{t.profile.noReviews}</p>}
      </section>
    </PageShell>
  )
}
