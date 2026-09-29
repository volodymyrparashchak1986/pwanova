import { Check, CircleDashed, MessageSquareQuote, X } from "lucide-react"
import { Link } from "@/components/i18n/link"
import type { Locale } from "@/i18n/config"
import type { Dictionary } from "@/i18n/dictionaries"
import { countryName, fmt, formatDate, formatPrice, languageName, pick } from "@/i18n/format"
import type { BuyerRequest } from "@/lib/data/requests"
import type { RequirementResult, RequirementStatus } from "@/lib/v2/matching"
import { factLabel } from "@/lib/v2/trust"
import type { FactAttribute } from "@/lib/v2/types"
import { cn, own } from "@/lib/utils"

export interface Lookups { registry: FactAttribute[]; categories: { slug: string; name: Record<string, string> }[]; useCases: { slug: string; name: Record<string, string> }[]; integrations: { slug: string; name: string }[] }

/** The readable name of one requirement, whatever kind it is. */
export function requirementLabel(kind: RequirementResult["kind"], key: string, t: Dictionary, locale: Locale, l: Lookups): string {
  switch (kind) {
    case "fact": { const a = l.registry.find((x) => x.key === key); return a ? factLabel(a, "yes", locale) : key }
    case "integration": return l.integrations.find((x) => x.slug === key)?.name ?? key
    case "platform": return own(t.filters.platforms, key) ?? key
    case "language": return languageName(locale, key)
    case "category": return pick(l.categories.find((x) => x.slug === key)?.name, locale, key)
    case "use_case": return pick(l.useCases.find((x) => x.slug === key)?.name, locale, key)
    case "budget": return t.requests.budgetWithin
  }
}

export function budgetText(r: Pick<BuyerRequest, "budgetMaxCents" | "budgetCurrency" | "budgetPerUser" | "budgetInterval">, t: Dictionary, locale: Locale): string | null {
  if (r.budgetMaxCents === null) return null
  const parts = [fmt(t.requests.upTo, { amount: formatPrice(locale, r.budgetMaxCents, r.budgetCurrency) })]
  if (r.budgetPerUser) parts.push(t.requests.fields.budgetPerUser)
  if (r.budgetInterval) parts.push((t.requests.intervals as Record<string, string>)[r.budgetInterval] ?? r.budgetInterval)
  return parts.join(" ")
}

/** Everything a request asks for, as chips. This is what vendors and the public see: requirements, never the person. */
export function Requirements({ request, t, locale, lookups, className }: { request: BuyerRequest; t: Dictionary; locale: Locale; lookups: Lookups; className?: string }) {
  const chips: { kind: RequirementResult["kind"]; key: string }[] = [
    ...request.categorySlugs.map((key) => ({ kind: "category" as const, key })),
    ...request.useCaseSlugs.map((key) => ({ kind: "use_case" as const, key })),
    ...request.requiredFacts.map((key) => ({ kind: "fact" as const, key })),
    ...request.requiredIntegrations.map((key) => ({ kind: "integration" as const, key })),
    ...request.requiredPlatforms.map((key) => ({ kind: "platform" as const, key })),
    ...request.languages.map((key) => ({ kind: "language" as const, key })),
  ]
  if (!chips.length) return <p className={cn("text-sm text-muted-foreground", className)}>{t.requests.noRequirements}</p>
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {chips.map((c) => <li key={`${c.kind}:${c.key}`} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-foreground/80">{requirementLabel(c.kind, c.key, t, locale, lookups)}</li>)}
    </ul>
  )
}

export function RequestFacts({ request, t, locale }: { request: BuyerRequest; t: Dictionary; locale: Locale }) {
  const rows: [string, string | null][] = [
    [t.requests.team, request.teamSize ? (t.requests.teamSizes as Record<string, string>)[request.teamSize] ?? request.teamSize : null],
    [t.requests.country, request.countryCode ? countryName(locale, request.countryCode) : null],
    [t.requests.budget, budgetText(request, t, locale)],
    [t.requests.timeframeLabel, request.timeframe ? (t.requests.timeframes as Record<string, string>)[request.timeframe] ?? request.timeframe : null],
  ]
  const shown = rows.filter(([, v]) => v)
  if (!shown.length) return null
  return <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">{shown.map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl>
}

export function RequestCard({ request, t, locale, lookups, mine = false }: { request: BuyerRequest; t: Dictionary; locale: Locale; lookups: Lookups; mine?: boolean }) {
  const status = (t.requests.status as Record<string, string>)[request.status] ?? request.status
  return (
    <article className="relative rounded-3xl border border-border bg-card p-5 shadow-soft transition-colors hover:border-brand/30">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className={cn("rounded-full px-2 py-0.5 font-medium", request.visibility === "public" ? "bg-brand/10 text-brand" : "bg-muted")}>{request.visibility === "public" ? t.requests.publicTag : t.requests.privateTag}</span>
        {mine && <span className="rounded-full border border-border px-2 py-0.5">{status}</span>}
        <time dateTime={request.createdAt}>{fmt(t.requests.postedOn, { date: formatDate(locale, request.createdAt) })}</time>
      </div>
      <h3 className="mt-2 text-lg leading-snug font-semibold"><Link href={`/requests/${request.id}`} className="after:absolute after:inset-0 after:rounded-3xl after:content-['']">{request.title}</Link></h3>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{request.problem}</p>
      <Requirements request={request} t={t} locale={locale} lookups={lookups} className="mt-3" />
    </article>
  )
}

const STATUS_STYLE: Record<RequirementStatus, string> = { met: "bg-ok/12 text-ok", met_vendor: "border border-border text-foreground/80", unverified: "border border-dashed border-border text-muted-foreground", not_met: "bg-muted text-muted-foreground" }
const STATUS_ICON = { met: Check, met_vendor: MessageSquareQuote, unverified: CircleDashed, not_met: X }

/** Why a product is on the short list: every requirement with how well it is documented. */
export function MatchReasons({ requirements, t, locale, lookups }: { requirements: RequirementResult[]; t: Dictionary; locale: Locale; lookups: Lookups }) {
  const label: Record<RequirementStatus, string> = { met: t.requests.reasons.met, met_vendor: t.requests.reasons.metVendor, unverified: t.requests.reasons.unverified, not_met: t.requests.reasons.notMet }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {requirements.map((r) => {
        const Icon = STATUS_ICON[r.status]
        return (
          <li key={`${r.kind}:${r.key}`} title={label[r.status]} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs", STATUS_STYLE[r.status])}>
            <Icon className="size-3" aria-hidden />{requirementLabel(r.kind, r.key, t, locale, lookups)}<span className="sr-only">: {label[r.status]}</span>
          </li>
        )
      })}
    </ul>
  )
}
