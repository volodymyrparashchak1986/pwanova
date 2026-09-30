import type { Metadata } from "next"
import { FlaskConical } from "lucide-react"
import { AppIcon } from "@/components/app/app-icon"
import { PartnerKit } from "@/components/app/partner-kit"
import { PageShell } from "@/components/app/section-header"
import { Stars } from "@/components/app/stars"
import { Link } from "@/components/i18n/link"
import { isLocale } from "@/i18n/config"
import { I18nScope } from "@/i18n/scope"
import { fmt } from "@/i18n/format"
import { getDictionary, getI18n } from "@/i18n/server"
import { exampleApp } from "@/lib/partner-example"
import { privateMetadata } from "@/lib/seo"

export async function generateMetadata({ params }: PageProps<"/[locale]/partners/demo">): Promise<Metadata> {
  const { locale } = await params
  return privateMetadata(isLocale(locale) ? getDictionary(locale).partners.demoTitle : "Example")
}

/**
 * A self-contained, clearly fictional worked example of the Partner Kit. "Vibeboard" is not a real
 * company and not a partner; the listing is a static sample in code (src/lib/partner-example.ts),
 * marked as demo data in the badge itself, never a real app and never a database row.
 */
export default async function PartnerDemoPage() {
  const { t } = await getI18n()
  const p = t.partners
  const app = exampleApp
  const listing = (
    <div className="flex items-center gap-3"><AppIcon app={app} size="sm" />
      <div><p className="font-semibold">{app.name}</p><p className="text-sm text-muted-foreground">{app.tagline}</p></div>
      <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-xs font-medium">▲ 214</span>
    </div>
  )
  return (
    <PageShell className="max-w-3xl">
      <p className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground"><FlaskConical className="size-3.5" aria-hidden />{p.demoTag}</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">{p.demoTitle}</h1>
      <p className="mt-2 text-muted-foreground">{p.demoBody}</p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-5"><p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{p.demoBefore}</p>{listing}</div>
        <div className="rounded-3xl border border-brand/30 bg-card p-5 shadow-soft">
          <p className="mb-3 text-xs font-semibold tracking-wide text-brand uppercase">{p.demoAfter}</p>
          {listing}
          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-sm">
            <Stars value={app.rating} size={13} label={fmt(t.common.starsOf, { value: app.rating.toFixed(1) })} /><span className="font-medium">{app.rating.toFixed(1)}</span>
            <span className="text-muted-foreground">· {fmt(p.demoRatings, { count: app.ratingsCount })}</span>
          </div>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">{p.demoLiveTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{p.demoLiveBody}</p>
        <div className="mt-4"><I18nScope namespaces={["partners"]}><PartnerKit apps={[{ slug: app.slug, name: `${app.name} (${p.kit.example})` }]} refCode="vibeboard-demo" /></I18nScope></div>
        <p className="mt-3 text-xs text-muted-foreground">{p.demoRefNote} <Link className="underline" href="/partners#api">{p.ctaApi}</Link></p>
      </section>
    </PageShell>
  )
}
