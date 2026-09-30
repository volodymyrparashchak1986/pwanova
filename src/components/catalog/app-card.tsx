import { AppIcon } from "@/components/app/app-icon"
import { DemoChip, OwnershipBadge } from "@/components/app/badges"
import { RatingInline } from "@/components/app/stars"
import { CompareButton } from "@/components/compare/compare-button"
import { Link } from "@/components/i18n/link"
import { SponsoredLabel, TrustSignal, VerificationStatus } from "@/components/trust/trust-signal"
import { PriceBadge } from "./price-badge"
import { SaveButton } from "./save-button"
import { countryName, fmt, pick } from "@/i18n/format"
import { getI18n } from "@/i18n/server"
import { getFactRegistry } from "@/lib/data/catalog"
import { localizedText } from "@/lib/v2/text"
import { factLabel, pickCardSignals } from "@/lib/v2/trust"
import type { CatalogApp } from "@/lib/v2/types"
import { cn } from "@/lib/utils"

export interface AppCardProps {
  app: CatalogApp
  /** Where the visitor came from, for first-party traffic statistics ("search", "home", …). */
  from?: string
  saved?: boolean
  signedIn?: boolean
  /** Paid placement. Rendered with a visible label and never inside the organic list. */
  sponsored?: boolean
  editorsPick?: boolean
  note?: string
  compareEnabled?: boolean
  className?: string
}

/**
 * The catalogue card. Signals are positive, sourced facts only: a card never shows a red cross
 * and never implies that something missing is a "no".
 */
export async function AppCard({ app, from, saved = false, signedIn = false, sponsored, editorsPick, note, compareEnabled = true, className }: AppCardProps) {
  const [{ t, locale }, registry] = await Promise.all([getI18n(), getFactRegistry()])
  const signals = pickCardSignals(app.facts, registry, 4)
  const text = localizedText(app, locale)
  const href = `/apps/${app.slug}${from ? `?from=${from}` : ""}`
  const meta = [app.category ? pick(app.category.name, locale) : null, app.company?.countryCode ? countryName(locale, app.company.countryCode) : null].filter(Boolean).join(" · ")
  return (
    <article className={cn("group relative flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lg", className)}>
      {(sponsored || editorsPick) && (
        <div className="flex items-center gap-2">
          {sponsored && <SponsoredLabel label={t.card.sponsored} help={t.card.sponsoredHelp} />}
          {editorsPick && !sponsored && <span className="rounded-md bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-brand uppercase">{t.card.editorsPick}</span>}
        </div>
      )}
      <div className="flex items-start gap-4">
        <AppIcon app={app} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base leading-tight font-semibold">
            <Link href={href} className="after:absolute after:inset-0 after:rounded-3xl after:content-['']" aria-label={fmt(t.card.openProfile, { name: app.name })}>{app.name}</Link>
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground" lang={text.lang !== locale ? text.lang : undefined}>{text.tagline}</p>
          {meta && <p className="mt-1.5 truncate text-xs text-muted-foreground">{meta}</p>}
          {note && <p className="mt-1.5 text-xs font-medium text-brand">{note}</p>}
        </div>
      </div>
      {signals.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t.card.signals}>
          {signals.map((s) => {
            const attr = registry.find((a) => a.key === s.key)
            if (!attr) return null
            return <li key={s.key}><TrustSignal label={factLabel(attr, "yes", locale)} state="yes" origin={s.origin} date={s.origin === "verified" ? s.checkedAt : s.statedAt} t={t.trust} locale={locale} /></li>
          })}
        </ul>
      )}
      <div className="mt-auto flex items-end justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <RatingInline rating={app.rating} count={app.ratingsCount} locale={locale} t={t.card} />
          <PriceBadge app={app} t={t.card} locale={locale} />
          <div className="relative z-10 flex flex-wrap items-center gap-1">
            <VerificationStatus state={app.verificationState} checkedAt={app.evidenceCheckedAt} t={t.trust} locale={locale} className="px-2 py-0.5 text-[11px]" />
            <OwnershipBadge status={app.ownershipStatus} t={t.card} />
            {app.isDemo && <DemoChip t={t.common} />}
          </div>
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-1.5">
          {compareEnabled && <CompareButton app={{ id: app.id, slug: app.slug, name: app.name, iconUrl: app.iconUrl }} />}
          <SaveButton appId={app.id} slug={app.slug} name={app.name} active={saved} signedIn={signedIn} />
        </div>
      </div>
    </article>
  )
}

/** Compact row for short lists (alternatives, similar apps, launches). */
export async function AppRow({ app, from, note }: { app: CatalogApp; from?: string; note?: string }) {
  const { t, locale } = await getI18n()
  const text = localizedText(app, locale)
  return (
    <article className="group relative flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-muted/60">
      <AppIcon app={app} size="sm" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] leading-tight font-semibold"><Link href={`/apps/${app.slug}${from ? `?from=${from}` : ""}`} className="after:absolute after:inset-0 after:content-['']">{app.name}</Link></h3>
        <p className="truncate text-xs text-muted-foreground">{note ?? text.tagline}</p>
        <RatingInline rating={app.rating} count={app.ratingsCount} locale={locale} t={t.card} className="mt-1" />
      </div>
      <VerificationStatus state={app.verificationState} checkedAt={app.evidenceCheckedAt} t={t.trust} locale={locale} className="hidden px-2 py-0.5 text-[11px] sm:inline-flex" />
    </article>
  )
}
