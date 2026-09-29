import type { Metadata } from "next"
import { BadgeCheck, CircleDashed, Download, FileSearch, Link2, MessageSquare } from "lucide-react"
import { PartnerKit } from "@/components/app/partner-kit"
import { PageShell } from "@/components/app/section-header"
import { Link } from "@/components/i18n/link"
import { buttonVariants } from "@/components/ui/button"
import { isLocale } from "@/i18n/config"
import { I18nScope } from "@/i18n/scope"
import { fmt } from "@/i18n/format"
import { getDictionary, getI18n } from "@/i18n/server"
import { getApps, getViewer } from "@/lib/data"
import { isSupabaseConfigured, siteUrl } from "@/lib/env"
import { exampleApp } from "@/lib/partner-example"
import { pageMetadata } from "@/lib/seo"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

export async function generateMetadata({ params }: PageProps<"/[locale]/partners">): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return pageMetadata({ locale, path: "/partners", title: t.partners.metaTitle, description: t.partners.metaDescription })
}

const ICONS = [BadgeCheck, FileSearch, CircleDashed, Download, MessageSquare, Link2]
const Code = ({ children }: { children: string }) => <pre className="mt-5 overflow-x-auto rounded-2xl bg-[oklch(0.17_0.03_275)] p-5 text-[13px] leading-relaxed text-white/90"><code>{children}</code></pre>

export default async function PartnersPage() {
  const [{ t, locale }, apps, viewer] = await Promise.all([getI18n(), getApps({ sort: "top", limit: 8 }), getViewer()])
  const p = t.partners
  const metrics = viewer && isSupabaseConfigured ? (await (await createClient()).rpc("partner_metrics", { p_days: 30 })).data ?? [] : []
  const kitApps = apps.length ? apps.map((a) => ({ slug: a.slug, name: a.name })) : [{ slug: exampleApp.slug, name: `${exampleApp.name} (${p.kit.example})` }]
  const sample = apps[0]?.slug ?? "your-app"
  return (
    <I18nScope namespaces={["partners"]}>
    <PageShell className="max-w-5xl">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-6xl">{p.titleLead} <span className="text-brand-gradient">{p.titleHighlight}</span></h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">{p.body}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href="#api" className={cn(buttonVariants({ size: "lg" }), "rounded-full")}>{p.ctaApi}</a>
          <a href="#badges" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "rounded-full")}>{p.ctaBadge}</a>
          <Link href="/partners/demo" className={cn(buttonVariants({ size: "lg", variant: "ghost" }), "rounded-full")}>{p.ctaExample}</Link>
        </div>
      </div>

      <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {p.benefits.map((b, i) => {
          const Icon = ICONS[i] ?? BadgeCheck
          return <div key={b.title} className="rounded-3xl border border-border bg-card p-6"><Icon className="size-6 text-brand" aria-hidden /><h2 className="mt-3 font-semibold">{b.title}</h2><p className="mt-1 text-sm text-muted-foreground">{b.body}</p></div>
        })}
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">{p.note}</p>

      <section id="badges" className="mt-16 scroll-mt-24">
        <h2 className="text-3xl font-semibold tracking-tight">{p.badgesTitle}</h2>
        <p className="mt-2 text-muted-foreground">{p.badgesBody} {p.tryBody}{!apps.length && ` ${p.tryEmpty}`}</p>
        <div className="mt-5"><PartnerKit apps={kitApps} /></div>
      </section>

      {metrics.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">{p.metricsTitle}</h2>
          <p className="text-sm text-muted-foreground">{p.metricsBody}</p>
          {metrics.map((m) => (
            <div key={m.referral_code} className="mt-4 rounded-2xl border border-border p-4">
              <h3 className="font-semibold">{m.partner}</h3>
              <p className="mb-3 text-sm text-muted-foreground">{fmt(p.metricsLine, { views: m.page_views, opens: m.outbound_opens, guides: m.guidance_views })}</p>
              <PartnerKit apps={kitApps} refCode={m.referral_code} />
            </div>
          ))}
        </section>
      )}

      <section id="api" className="mt-20 scroll-mt-24">
        <h2 className="text-3xl font-semibold tracking-tight">{p.apiTitle}</h2>
        <p className="mt-2 text-muted-foreground">{p.apiBody}</p>
        <h3 className="mt-6 text-lg font-semibold">{p.apiEndpoints}</h3>
        <dl className="mt-3 divide-y divide-border/70 rounded-3xl border border-border bg-card px-5">
          {p.endpoints.map((e) => <div key={e.path} className="py-3"><dt className="font-mono text-[13px] font-semibold">{e.path}</dt><dd className="mt-0.5 text-sm text-muted-foreground">{e.body}</dd></div>)}
        </dl>
        <Code>{`GET ${siteUrl}/api/v1/apps/${sample}?lang=${locale}

{
  "apiVersion": "1",
  "lang": "${locale}",
  "data": {
    "slug": "${sample}",
    "name": "…",
    "verification": { "state": "partially_verified", "evidenceCompleteness": 46, "lastCheckedAt": "2026-09-29T04:00:12Z" },
    "ownership": "verified_owner",
    "rating": null,
    "facts": [
      {
        "key": "privacy_policy",
        "state": "yes",
        "origin": "verified",
        "verified": { "state": "yes", "value": "https://…/privacy", "by": "pwanova_observed", "source": "https://…/privacy", "at": "2026-09-29T04:00:12Z" },
        "vendorStatement": null,
        "lastAttempt": { "at": "2026-09-29T04:00:12Z", "outcome": "found" }
      },
      {
        "key": "dpa_available",
        "state": "yes",
        "origin": "vendor",
        "verified": null,
        "vendorStatement": { "state": "yes", "value": "https://…/dpa", "source": "https://…/dpa", "at": "2026-09-20T10:31:00Z" },
        "lastAttempt": { "at": "2026-09-29T04:00:12Z", "outcome": "not_found" }
      }
    ]
  }
}`}</Code>
        <ul className="mt-5 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{p.apiNotes.map((n) => <li key={n}>{n}</li>)}</ul>
        <h3 className="mt-8 text-lg font-semibold">{p.legacyTitle}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{p.legacyBody}</p>
      </section>

      <section className="mt-16 rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <h2 className="mb-2 text-lg font-semibold text-foreground">{p.attributionTitle}</h2>
        <dl className="mt-3 space-y-2">{p.attribution.map((a) => <div key={a.term}><dt className="font-medium text-foreground">{a.term}</dt><dd>{a.body}</dd></div>)}</dl>
      </section>
    </PageShell>
    </I18nScope>
  )
}
