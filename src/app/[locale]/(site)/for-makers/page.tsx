import type { Metadata } from "next"
import { BarChart3, FileCheck2, GitCompareArrows, Globe2, IdCard, Inbox, Rocket, ShieldCheck } from "lucide-react"
import { PageShell } from "@/components/app/section-header"
import { Link } from "@/components/i18n/link"
import { buttonVariants } from "@/components/ui/button"
import { isLocale } from "@/i18n/config"
import { getDictionary, getI18n } from "@/i18n/server"
import { pageMetadata } from "@/lib/seo"
import { cn } from "@/lib/utils"

export async function generateMetadata({ params }: PageProps<"/[locale]/for-makers">): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return pageMetadata({ locale, path: "/for-makers", title: t.nav.forMakers, description: t.makers.metaDescription })
}

const ICONS = [IdCard, Globe2, ShieldCheck, GitCompareArrows, Rocket, FileCheck2, BarChart3, Inbox]

export default async function ForMakersPage() {
  const { t } = await getI18n()
  const m = t.makers
  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 -top-32 mx-auto h-96 max-w-3xl rounded-full bg-brand-gradient opacity-20 blur-[100px]" />
        <div className="relative mx-auto max-w-3xl px-4 pt-16 pb-14 text-center md:pt-24">
          <p className="text-sm font-semibold tracking-widest text-brand uppercase">{m.eyebrow}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance md:text-6xl">{m.title}</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">{m.body}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/submit" className={cn(buttonVariants({ size: "lg" }), "rounded-full")}><Rocket className="size-4" aria-hidden />{m.cta}</Link>
            <Link href="/discover" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "rounded-full")}>{m.secondary}</Link>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{m.claimHint}</p>
        </div>
      </section>

      <PageShell className="pt-0">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {m.benefits.map((b, i) => {
            const Icon = ICONS[i] ?? IdCard
            return (
              <div key={b.title} className="rounded-3xl border border-border bg-card p-6 shadow-soft">
                <span className="grid size-10 place-items-center rounded-xl bg-brand/10 text-brand"><Icon className="size-5" aria-hidden /></span>
                <h2 className="mt-4 font-semibold">{b.title}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{b.body}</p>
              </div>
            )
          })}
        </div>

        <div className="mt-16 grid items-center gap-8 rounded-[2rem] border border-border bg-card p-8 md:grid-cols-2 md:p-12">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">{m.stepsTitle}</h2>
            <ol className="mt-5 space-y-4">
              {m.steps.map((s, i) => (
                <li key={s} className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span><span className="text-muted-foreground">{s}</span></li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl bg-muted p-5 font-mono text-[13px] leading-relaxed">
            <p className="break-all text-muted-foreground"># https://your-app.example/.well-known/pwanova-verification.txt</p>
            <p className="mt-1 break-all">3f9c…e21b</p>
            <p className="mt-3 text-muted-foreground"># {m.fileComment}</p>
          </div>
        </div>

        <section className="mt-12 rounded-3xl border border-border bg-accent/40 p-6 md:p-8">
          <h2 className="text-xl font-semibold">{m.verifyTitle}</h2>
          <p className="mt-2 max-w-3xl text-muted-foreground">{m.verifyBody}</p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
            <Link href="/verification-methodology" className="text-brand hover:underline">{t.footer.links.methodology}</Link>
            <Link href="/how-ranking-works" className="text-brand hover:underline">{t.footer.links.ranking}</Link>
            <Link href="/pricing" className="text-brand hover:underline">{m.pricingCta}</Link>
          </div>
        </section>
        <div className="mt-12 text-center"><Link href="/submit" className={cn(buttonVariants({ size: "lg" }), "rounded-full")}>{m.cta}</Link></div>
      </PageShell>
    </>
  )
}
