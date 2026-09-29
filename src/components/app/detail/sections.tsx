import { ExternalLink } from "lucide-react"
import { SourceLink } from "@/components/trust/fact-row"
import type { Locale } from "@/i18n/config"
import type { Dictionary } from "@/i18n/dictionaries"
import { countryName, fmt, formatDate, formatPrice } from "@/i18n/format"
import type { AppDetail, AppUpdate, PricingPlan, SourcedItem, SourceType } from "@/lib/v2/types"
import { cn } from "@/lib/utils"

export const sourceLabel = (t: Dictionary["trust"], type: SourceType) =>
  type === "pwanova_observed" ? t.sourceObserved : type === "admin_reviewed" ? t.sourceReviewed : type === "vendor_stated" ? t.sourceVendor : t.sourceUser

/** Where a piece of structured information comes from. Verified and stated look different on purpose. */
export function SourceTag({ item, t, locale, className }: { item: SourcedItem; t: Dictionary["trust"]; locale: Locale; className?: string }) {
  const verified = item.sourceType === "pwanova_observed" || item.sourceType === "admin_reviewed"
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px]", verified ? "bg-ok/12 font-medium text-ok" : "border border-border text-muted-foreground", className)}
      title={item.verifiedAt ? fmt(t.lastChecked, { date: formatDate(locale, item.verifiedAt) }) : undefined}>
      {sourceLabel(t, item.sourceType)}
    </span>
  )
}

export function Section({ id, title, children, aside }: { id?: string; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-24" aria-labelledby={id ? `${id}-h` : undefined}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 id={id ? `${id}-h` : undefined} className="text-2xl font-semibold tracking-tight">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export const Card = ({ children, className }: { children: React.ReactNode; className?: string }) =>
  <div className={cn("rounded-3xl border border-border bg-card p-5 md:p-6", className)}>{children}</div>

export const Muted = ({ children }: { children: React.ReactNode }) => <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">{children}</p>

function planPrice(p: PricingPlan, t: Dictionary["app"], locale: Locale): string {
  if (p.billingInterval === "free" || p.priceCents === 0) return t.intervals.free
  if (p.priceCents === null) return p.billingInterval === "custom" ? t.priceOnRequest : t.intervals[p.billingInterval]
  const price = formatPrice(locale, p.priceCents, p.currency ?? "EUR")
  return `${price} ${t.intervals[p.billingInterval]}`
}

/** Prices are the vendor's statement unless PWANova read them from the pricing page; the note says which. */
export function PricingPlans({ plans, t, locale }: { plans: PricingPlan[]; t: Dictionary; locale: Locale }) {
  if (!plans.length) return <Muted>{t.app.noPricing}</Muted>
  const newest = plans.map((p) => p.verifiedAt ?? p.updatedAt).sort().at(-1)
  const verified = plans.every((p) => p.sourceType === "pwanova_observed" || p.sourceType === "admin_reviewed")
  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => (
          <li key={p.id} className="flex flex-col rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">{p.name}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{planPrice(p, t.app, locale)}{p.perUser && p.priceCents ? <span className="text-sm font-normal text-muted-foreground"> · {t.card.perUser}</span> : null}</p>
            {p.description && <p className="mt-1.5 text-sm text-muted-foreground">{p.description}</p>}
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-3"><SourceTag item={p} t={t.trust} locale={locale} />{p.sourceUrl && <SourceLink url={p.sourceUrl} label={t.trust.viewSource} />}</div>
          </li>
        ))}
      </ul>
      {newest && <p className="mt-3 text-xs text-muted-foreground">{fmt(verified ? t.app.pricingVerified : t.app.pricingSource, { date: formatDate(locale, newest) })}</p>}
    </>
  )
}

export function TagList({ items, t, locale, empty }: { items: (SourcedItem & { key: string; label: string })[]; t: Dictionary["trust"]; locale: Locale; empty: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((i) => {
        const verified = i.sourceType === "pwanova_observed" || i.sourceType === "admin_reviewed"
        return (
          <li key={i.key} title={`${sourceLabel(t, i.sourceType)}${i.verifiedAt ? ` · ${formatDate(locale, i.verifiedAt)}` : ""}`}
            className={cn("rounded-full px-3 py-1 text-sm", verified ? "bg-ok/12 text-ok" : "border border-border text-foreground/80")}>
            {i.label}<span className="sr-only"> ({sourceLabel(t, i.sourceType)})</span>
          </li>
        )
      })}
    </ul>
  )
}

export function DataTable({ detail, t, locale }: { detail: AppDetail; t: Dictionary; locale: Locale }) {
  const blocks: { title: string; empty: string; rows: { key: string; main: string; sub: string | null; item: SourcedItem }[] }[] = [
    {
      title: t.app.dataLocations, empty: t.app.noDataLocations,
      rows: detail.dataLocations.map((d) => ({ key: d.id, main: [(t.app.regions as Record<string, string>)[d.region] ?? d.region, d.countryCode ? countryName(locale, d.countryCode) : null].filter(Boolean).join(" · ") + (d.isDefault ? ` (${t.app.defaultLocation})` : ""), sub: d.description, item: d })),
    },
    {
      title: t.app.subprocessors, empty: t.app.noSubprocessors,
      rows: detail.subprocessors.map((d) => ({ key: d.id, main: [d.name, d.countryCode ? countryName(locale, d.countryCode) : null].filter(Boolean).join(" · "), sub: d.purpose, item: d })),
    },
    {
      title: t.app.aiProviders, empty: t.app.noAiProviders,
      rows: detail.aiProviders.map((d) => ({ key: d.id, main: [d.provider, d.modelName].filter(Boolean).join(" · "), sub: d.purpose, item: d })),
    },
  ]
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {blocks.map((b) => (
        <Card key={b.title} className="p-5!">
          <h3 className="text-sm font-semibold">{b.title}</h3>
          {b.rows.length ? (
            <ul className="mt-3 space-y-3">
              {b.rows.map((r) => (
                <li key={r.key} className="text-sm">
                  <p className="font-medium">{r.main}</p>
                  {r.sub && <p className="text-muted-foreground">{r.sub}</p>}
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs"><SourceTag item={r.item} t={t.trust} locale={locale} />{r.item.sourceUrl && <SourceLink url={r.item.sourceUrl} label={t.trust.viewSource} />}</p>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-muted-foreground">{b.empty} {t.trust.notVerified}.</p>}
        </Card>
      ))}
    </div>
  )
}

export function Updates({ updates, t, locale }: { updates: AppUpdate[]; t: Dictionary; locale: Locale }) {
  if (!updates.length) return <Muted>{t.app.noUpdates}</Muted>
  const kinds = t.app.updateKinds as Record<string, string>
  return (
    <ol className="space-y-3">
      {updates.map((u) => (
        <li key={u.id} className="rounded-2xl border border-border bg-card p-4">
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground/80">{kinds[u.kind] ?? kinds.other}</span>
            {u.version && <span className="font-mono">{u.version}</span>}
            {u.publishedAt && <time dateTime={u.publishedAt}>{formatDate(locale, u.publishedAt)}</time>}
          </p>
          <h3 className="mt-1.5 font-semibold">{u.title}</h3>
          {u.body && <p className="mt-1 text-sm whitespace-pre-line text-foreground/85">{u.body}</p>}
          {u.linkUrl && /^https?:\/\//i.test(u.linkUrl) && (
            <a href={u.linkUrl} target="_blank" rel="nofollow noopener noreferrer ugc" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">{t.common.learnMore}<ExternalLink className="size-3.5" aria-hidden /></a>
          )}
        </li>
      ))}
    </ol>
  )
}
