import type { Metadata } from "next"
import { Check } from "lucide-react"
import { PageHeader, PageShell } from "@/components/app/section-header"
import { Link } from "@/components/i18n/link"
import { buttonVariants } from "@/components/ui/button"
import { isLocale } from "@/i18n/config"
import { formatPrice, pick } from "@/i18n/format"
import { getDictionary, getI18n } from "@/i18n/server"
import { getPlans, getPublicSettings, type PlanInfo } from "@/lib/data/catalog"
import { pageMetadata } from "@/lib/seo"
import { cn } from "@/lib/utils"

export async function generateMetadata({ params }: PageProps<"/[locale]/pricing">): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return pageMetadata({ locale, path: "/pricing", title: t.pricing.title, description: t.pricing.metaDescription })
}

const AUDIENCES: PlanInfo["audience"][] = ["maker", "vendor", "sponsor"]

export default async function PricingPage() {
  const [{ t, locale }, plans, settings] = await Promise.all([getI18n(), getPlans(), getPublicSettings()])
  const p = t.pricing
  const interval: Record<PlanInfo["billingInterval"], string> = { free: p.free, one_time: p.oneTime, month: p.perMonth, issue: p.perIssue }
  return (
    <PageShell>
      <PageHeader title={p.title} body={p.body} />
      {!settings.monetizationEnforced && (
        <p className="mb-10 max-w-3xl rounded-2xl border border-border bg-accent/40 p-4 text-sm"><strong>{p.betaTitle}.</strong> {p.betaBody}</p>
      )}
      {AUDIENCES.map((audience) => {
        const list = plans.filter((x) => x.audience === audience)
        if (!list.length) return null
        return (
          <section key={audience} className="mb-12" aria-labelledby={`plans-${audience}`}>
            <h2 id={`plans-${audience}`} className="mb-4 text-2xl font-semibold tracking-tight">{p.audience[audience]}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {list.map((plan) => (
                <div key={plan.slug} className={cn("flex flex-col rounded-3xl border bg-card p-6", plan.isAvailable ? "border-brand shadow-soft" : "border-border")}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold">{pick(plan.name, locale)}</h3>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", plan.isAvailable ? "bg-ok/12 text-ok" : "bg-muted text-muted-foreground")} title={plan.isAvailable ? undefined : p.announcedHelp}>{plan.isAvailable ? p.available : p.announced}</span>
                  </div>
                  <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{plan.priceCents === 0 ? p.free : formatPrice(locale, plan.priceCents, plan.currency)}</p>
                  <p className="text-sm text-muted-foreground">{plan.priceCents === 0 ? " " : `${interval[plan.billingInterval]}${plan.isAvailable ? "" : ` · ${p.approx}`}`}</p>
                  <p className="mt-3 text-sm text-muted-foreground">{pick(plan.summary, locale)}</p>
                  <ul className="mt-4 flex-1 space-y-2 text-sm">
                    {plan.features.map((f) => <li key={pick(f, locale)} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />{pick(f, locale)}</li>)}
                  </ul>
                  {plan.isAvailable
                    ? <Link href="/submit" className={cn(buttonVariants(), "mt-6 rounded-full")}>{p.cta}</Link>
                    : <span className={cn(buttonVariants({ variant: "outline" }), "pointer-events-none mt-6 rounded-full opacity-60")} aria-disabled>{p.notOrderable}</span>}
                </div>
              ))}
            </div>
          </section>
        )
      })}
      <ul className="max-w-3xl list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
        {p.notes.map((n) => <li key={n}>{n}</li>)}
        <li>{p.vat}</li>
      </ul>
      <p className="mt-6 text-sm"><Link href="/sponsorship" className="font-medium text-brand hover:underline">{t.footer.links.sponsorship}</Link> · <Link href="/how-ranking-works" className="font-medium text-brand hover:underline">{t.footer.links.ranking}</Link></p>
    </PageShell>
  )
}
