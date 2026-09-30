import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Lock } from "lucide-react"
import { EmptyState, PageHeader, PageShell } from "@/components/app/section-header"
import { Link } from "@/components/i18n/link"
import { RequestCard } from "@/components/requests/request-parts"
import { buttonVariants } from "@/components/ui/button"
import { isLocale } from "@/i18n/config"
import { getDictionary, getI18n } from "@/i18n/server"
import { getViewer } from "@/lib/data"
import { getPublicSettings } from "@/lib/data/catalog"
import { getLookups } from "@/lib/data/lookups"
import { getMyRequests, getPublicRequests } from "@/lib/data/requests"
import { pageMetadata } from "@/lib/seo"
import { cn } from "@/lib/utils"

export async function generateMetadata({ params }: PageProps<"/[locale]/requests">): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = getDictionary(locale)
  return pageMetadata({ locale, path: "/requests", title: t.requests.title, description: t.requests.metaDescription })
}

export default async function RequestsPage() {
  const [{ t, locale }, viewer, settings] = await Promise.all([getI18n(), getViewer(), getPublicSettings()])
  if (!settings.features.requests) notFound()
  const [open, mine, lookups] = await Promise.all([getPublicRequests(30), viewer ? getMyRequests(viewer.id) : Promise.resolve([]), getLookups()])
  const others = open.filter((r) => r.ownerId !== viewer?.id)
  return (
    <PageShell>
      <PageHeader title={t.requests.title} body={t.requests.body}>
        <div className="mt-5"><Link href="/requests/new" className={cn(buttonVariants({ size: "lg" }), "rounded-full")}>{t.requests.cta}</Link></div>
      </PageHeader>

      <section className="rounded-3xl border border-border bg-card p-5 md:p-6" aria-labelledby="privacy-h">
        <h2 id="privacy-h" className="flex items-center gap-2 text-base font-semibold"><Lock className="size-4 text-brand" aria-hidden />{t.requests.privacyTitle}</h2>
        <ul className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">{t.requests.privacy.map((p) => <li key={p} className="flex gap-2"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />{p}</li>)}</ul>
      </section>

      {viewer && (
        <section className="mt-12" aria-labelledby="mine-h">
          <h2 id="mine-h" className="mb-4 text-2xl font-semibold tracking-tight">{t.requests.mine}</h2>
          {mine.length
            ? <div className="grid gap-4 lg:grid-cols-2">{mine.map((r) => <RequestCard key={r.id} request={r} t={t} locale={locale} lookups={lookups} mine />)}</div>
            : <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">{t.requests.emptyMine}</p>}
        </section>
      )}

      <section className="mt-12" aria-labelledby="public-h">
        <h2 id="public-h" className="mb-4 text-2xl font-semibold tracking-tight">{t.requests.publicList}</h2>
        {others.length
          ? <div className="grid gap-4 lg:grid-cols-2">{others.map((r) => <RequestCard key={r.id} request={r} t={t} locale={locale} lookups={lookups} />)}</div>
          : <EmptyState title={t.requests.emptyPublic}><Link href="/requests/new" className={cn(buttonVariants(), "rounded-full")}>{t.requests.cta}</Link></EmptyState>}
      </section>
    </PageShell>
  )
}
