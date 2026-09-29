import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowLeft, Check, CircleDashed, ExternalLink, Lock } from "lucide-react"
import { AppIcon } from "@/components/app/app-icon"
import { OwnershipBadge } from "@/components/app/badges"
import { SourceTag } from "@/components/app/detail/sections"
import { PageShell } from "@/components/app/section-header"
import { ListingForm } from "@/components/dashboard/listing-form"
import { CancelLaunchButton, DetailForm, LaunchForm, PlanForm, RecheckButton, RemoveButton, RetractButton, StatementForm, UpdateForm } from "@/components/dashboard/maker-forms"
import { Link } from "@/components/i18n/link"
import { answerLabel, FactList } from "@/components/trust/fact-row"
import { CompletenessMeter } from "@/components/trust/trust-snapshot"
import { VerificationStatus } from "@/components/trust/trust-signal"
import { buttonVariants } from "@/components/ui/button"
import { isLocale, type Locale } from "@/i18n/config"
import { I18nScope } from "@/i18n/scope"
import type { Dictionary } from "@/i18n/dictionaries"
import { countryName, fmt, formatDate, formatPrice, pick } from "@/i18n/format"
import { getDictionary, getI18n } from "@/i18n/server"
import { requireViewer } from "@/lib/auth"
import { getCategories, getFactRegistry, getIntegrationCatalog, getPlans, getPublicSettings, getUseCases } from "@/lib/data/catalog"
import { getMakerApp, type MakerApp } from "@/lib/data/maker"
import { privateMetadata } from "@/lib/seo"
import { countryChoices, languageChoices } from "@/lib/v2/choices"
import { NOT_STATEABLE as NOT_STATEABLE_KEYS } from "@/lib/v2/options"
import { factLabel } from "@/lib/v2/trust"
import type { FactAttribute, SourceType } from "@/lib/v2/types"
import { cn } from "@/lib/utils"

type Props = PageProps<"/[locale]/dashboard/apps/[slug]">
const NOT_STATEABLE: readonly string[] = NOT_STATEABLE_KEYS
const TABS = ["overview", "profile", "evidence", "pricing", "details", "updates", "launches", "plan"] as const
type Tab = (typeof TABS)[number]

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return privateMetadata(isLocale(locale) ? getDictionary(locale).dashboard.manage : "Manage")
}

const Card = ({ title, body, children, id }: { title: string; body?: string; children: React.ReactNode; id?: string }) => (
  <section id={id} className="rounded-3xl border border-border bg-card p-5 md:p-6">
    <h2 className="text-lg font-semibold">{title}</h2>
    {body && <p className="mt-1 text-sm text-muted-foreground">{body}</p>}
    <div className="mt-4">{children}</div>
  </section>
)
const isOwn = (s: SourceType) => s === "vendor_stated" || s === "user_submitted"

function Overview({ app, t, locale }: { app: MakerApp; t: Dictionary; locale: Locale }) {
  const d = t.dashboard
  const items = d.items as Record<string, string>
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={d.verificationStatus}>
        <div className="flex flex-wrap items-center gap-2">
          <VerificationStatus state={app.verificationState} checkedAt={app.evidenceCheckedAt} t={t.trust} locale={locale} />
          <OwnershipBadge status={app.ownershipStatus} t={t.card} showUnverified />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{app.evidenceCheckedAt ? fmt(d.checked, { date: formatDate(locale, app.evidenceCheckedAt) }) : d.evidenceNone}{app.nextCheckAt ? ` ${fmt(d.nextCheck, { date: formatDate(locale, app.nextCheckAt) })}` : ""}</p>
        <CompletenessMeter score={app.evidenceScore} t={t.trust} className="mt-4" />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <RecheckButton appId={app.id} />
          {app.status === "published" && <Link href={`/apps/${app.slug}/evidence`} className="text-sm font-medium text-brand hover:underline">{d.viewEvidence}</Link>}
        </div>
        {app.ownershipStatus !== "verified_owner" && <p className="mt-4 rounded-xl bg-accent/50 p-3 text-sm">{d.evidence.needOwnership} <Link href={`/apps/${app.slug}/claim`} className="font-medium text-brand hover:underline">{d.verifyOwnership}</Link></p>}
      </Card>
      <Card title={d.completeness} body={d.completenessHelp}>
        <div className="flex items-baseline justify-between text-sm"><span className="font-medium">{d.profileStatus}</span><span className="tabular-nums text-muted-foreground">{app.report.score} %</span></div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={app.report.score} aria-label={d.completeness}><div className="h-full rounded-full bg-brand-gradient" style={{ width: `${app.report.score}%` }} /></div>
        <ul className="mt-4 grid gap-1.5 text-sm sm:grid-cols-2">
          {[...app.report.missing.map((k) => [k, false] as const), ...app.report.done.map((k) => [k, true] as const)].map(([key, done]) => (
            <li key={key} className={cn("flex items-start gap-2", done && "text-muted-foreground")}>
              {done ? <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />}
              <span>{items[key] ?? key}<span className="sr-only"> ({done ? d.done : d.missing})</span></span>
            </li>
          ))}
        </ul>
        {app.report.missing.length > 0 && <p className="mt-3 text-xs text-muted-foreground">{d.missingHint}</p>}
      </Card>
    </div>
  )
}

function Evidence({ app, registry, t, locale }: { app: MakerApp; registry: FactAttribute[]; t: Dictionary; locale: Locale }) {
  const d = t.dashboard
  const stateable = registry.filter((a) => !NOT_STATEABLE.includes(a.key) && a.valueType !== "country")
  const statusName = t.trust.statuses as Record<string, string>
  return (
    <div className="space-y-4">
      <Card title={d.evidence.add} body={d.evidence.body}>
        {app.ownershipStatus !== "verified_owner" && <p className="mb-4 rounded-xl bg-accent/50 p-3 text-sm">{d.evidence.needOwnership}</p>}
        <StatementForm appId={app.id} facts={stateable.map((a) => ({ value: a.key, label: pick(a.label, locale), valueType: a.valueType, yes: factLabel(a, "yes", locale), no: factLabel(a, "no", locale) }))} />
      </Card>
      <Card title={d.evidence.yours}>
        {app.statements.length ? (
          <ul className="divide-y divide-border/70">
            {app.statements.map((s) => {
              const attr = registry.find((a) => a.key === s.key)
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                  <span className="min-w-0 flex-1"><span className="font-medium">{attr ? pick(attr.label, locale) : s.key}</span>: {attr ? answerLabel(attr, s.state, s.value, locale) : t.trust.answer[s.state]}{s.value && attr?.valueType === "text" ? ` · ${s.value}` : ""}
                    <span className="block truncate text-xs text-muted-foreground">{formatDate(locale, s.collectedAt)} · {s.sourceUrl ?? t.trust.noSource}{s.reviewNote ? ` · ${s.reviewNote}` : ""}</span></span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px]", s.status === "current" ? "bg-brand/10 font-medium text-brand" : "bg-muted text-muted-foreground")}>{statusName[s.status] ?? s.status}</span>
                  {s.status === "current" && s.sourceType === "vendor_stated" && !NOT_STATEABLE.includes(s.key) && <RetractButton id={s.id} />}
                </li>
              )
            })}
          </ul>
        ) : <p className="text-sm text-muted-foreground">{d.evidence.none}</p>}
      </Card>
      <Card title={d.facts} body={d.factsBody}><FactList attrs={registry.filter((a) => a.isExpected || app.facts.some((f) => f.key === a.key))} facts={app.facts} t={t.trust} locale={locale} /></Card>
    </div>
  )
}

function Pricing({ app, t, locale }: { app: MakerApp; t: Dictionary; locale: Locale }) {
  const p = t.dashboard.pricingForm
  return (
    <div className="space-y-4">
      <Card title={p.title} body={p.body}>
        {app.pricingPlans.length ? (
          <ul className="divide-y divide-border/70">
            {app.pricingPlans.map((plan) => (
              <li key={plan.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <span className="min-w-0 flex-1"><span className="font-medium">{plan.name}</span> · {plan.priceCents === null ? t.app.intervals[plan.billingInterval as "custom"] : plan.priceCents === 0 ? t.app.intervals.free : `${formatPrice(locale, plan.priceCents, plan.currency ?? "EUR")} ${t.app.intervals[plan.billingInterval as "month"]}`}{plan.perUser ? ` · ${t.card.perUser}` : ""}
                  {plan.description && <span className="block text-xs text-muted-foreground">{plan.description}</span>}</span>
                <SourceTag item={{ sourceType: plan.sourceType, sourceUrl: plan.sourceUrl, verifiedAt: null }} t={t.trust} locale={locale} />
                {isOwn(plan.sourceType) && <RemoveButton kind="pricing_plan" appId={app.id} id={plan.id} label={`${t.common.remove}: ${plan.name}`} />}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">{p.none}</p>}
      </Card>
      <Card title={p.add}><PlanForm appId={app.id} /></Card>
    </div>
  )
}

function Details({ app, t, locale }: { app: MakerApp; t: Dictionary; locale: Locale }) {
  const d = t.dashboard.details
  const regions = t.app.regions as Record<string, string>
  const blocks = [
    { kind: "data_location" as const, title: d.locations, rows: app.dataLocations.map((x) => ({ id: x.id, text: [regions[x.region] ?? x.region, x.countryCode ? countryName(locale, x.countryCode) : null, x.description].filter(Boolean).join(" · "), source: x })) },
    { kind: "subprocessor" as const, title: d.subprocessors, rows: app.subprocessors.map((x) => ({ id: x.id, text: [x.name, x.countryCode ? countryName(locale, x.countryCode) : null, x.purpose].filter(Boolean).join(" · "), source: x })) },
    { kind: "ai_provider" as const, title: d.aiProviders, rows: app.aiProviders.map((x) => ({ id: x.id, text: [x.provider, x.modelName, x.purpose].filter(Boolean).join(" · "), source: x })) },
    { kind: "alternative" as const, title: d.alternatives, rows: app.alternatives.map((x) => ({ id: x.slug, text: x.name, source: x })) },
  ]
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{d.body}</p>
      {blocks.map((b) => (
        <Card key={b.kind} title={b.title}>
          {b.rows.length ? (
            <ul className="mb-5 divide-y divide-border/70">
              {b.rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">{r.text}</span>
                  <SourceTag item={{ sourceType: r.source.sourceType, sourceUrl: r.source.sourceUrl, verifiedAt: null }} t={t.trust} locale={locale} />
                  {isOwn(r.source.sourceType) ? <RemoveButton kind={b.kind} appId={app.id} id={r.id} label={`${t.common.remove}: ${r.text}`} /> : <span className="text-muted-foreground" title={d.observed}><Lock className="size-4" aria-hidden /><span className="sr-only">{d.observed}</span></span>}
                </li>
              ))}
            </ul>
          ) : <p className="mb-5 text-sm text-muted-foreground">{d.none}</p>}
          <DetailForm appId={app.id} kind={b.kind} countries={countryChoices(locale)} />
        </Card>
      ))}
    </div>
  )
}

export default async function ManageAppPage({ params, searchParams }: Props) {
  const [{ slug }, sp, { t, locale }] = await Promise.all([params, searchParams, getI18n()])
  const viewer = await requireViewer(`/dashboard/apps/${slug}`)
  const app = await getMakerApp(slug, viewer.id)
  if (!app) notFound()
  const [registry, categories, useCases, integrations, settings, plans] = await Promise.all([getFactRegistry(), getCategories(), getUseCases(), getIntegrationCatalog(), getPublicSettings(), getPlans()])
  const d = t.dashboard
  const tab: Tab = (TABS as readonly string[]).includes(String(sp.tab)) ? (sp.tab as Tab) : "overview"
  const verified = app.ownershipStatus === "verified_owner"
  const visible = TABS.filter((k) => k !== "launches" || settings.features.launches)
  const statusName = d.status as Record<string, string>
  const today = new Date().toISOString().slice(0, 10)
  const launchStatus = t.launches.status as Record<string, string>
  const activeLaunch = app.launches.find((l) => l.status === "pending" || (l.status === "approved" && l.windowEnd && new Date(l.windowEnd) > new Date()))

  return (
    <I18nScope namespaces={["dashboard", "submit", "launches"]}>
    <PageShell>
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />{d.back}</Link>
      <header className="mt-4 flex flex-wrap items-start gap-4">
        <AppIcon app={app} size="md" />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight">{app.name}</h1>
          <p className="text-sm text-muted-foreground">{app.domain} · {statusName[app.status] ?? app.status}</p>
          {app.moderationNote && <p className="mt-2 rounded-xl bg-muted p-2.5 text-sm"><strong>{d.note}:</strong> {app.moderationNote}</p>}
        </div>
        {app.status === "published" && <Link href={`/apps/${app.slug}`} className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}>{d.viewPublic}<ExternalLink className="size-4" aria-hidden /></Link>}
      </header>

      <nav className="no-scrollbar -mx-4 mt-6 mb-6 flex gap-1 overflow-x-auto border-b border-border px-4" aria-label={d.tabsLabel}>
        {visible.map((k) => (
          <Link key={k} href={`/dashboard/apps/${app.slug}${k === "overview" ? "" : `?tab=${k}`}`} aria-current={k === tab ? "page" : undefined}
            className={cn("-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap", k === tab ? "border-brand font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {k === "details" ? d.details.title : d.tabs[k]}
          </Link>
        ))}
      </nav>

      {tab === "overview" && <Overview app={app} t={t} locale={locale} />}

      {tab === "profile" && (
        <ListingForm
          initial={{
            appId: app.id, tagline: app.tagline, description: app.description, contentLocale: app.contentLocale, taglineDe: app.taglineDe, descriptionDe: app.descriptionDe,
            category: app.categorySlug ?? "", useCases: app.useCases, pricingModel: app.pricingModel, hasFreePlan: app.hasFreePlan, hasFreeTrial: app.hasFreeTrial,
            startingPrice: app.startingPriceCents === null ? null : app.startingPriceCents / 100, priceCurrency: app.priceCurrency ?? "EUR",
            languages: app.languages.map((l) => l.code), platforms: app.platforms.map((p) => p.platform).filter((p) => p !== "web" && p !== "pwa"),
            integrations: app.integrations.map((i) => i.slug), companyName: app.company?.name ?? "", companyCountry: app.company?.countryCode ?? "", aliases: app.aliases,
          }}
          locked={{
            languages: app.languages.filter((l) => !isOwn(l.sourceType)).map((l) => l.code), platforms: app.platforms.filter((p) => !isOwn(p.sourceType)).map((p) => p.platform),
            integrations: app.integrations.filter((i) => !isOwn(i.sourceType)).map((i) => i.slug),
          }}
          categories={categories.map((c) => ({ value: c.slug, label: pick(c.name, locale) })).sort((a, b) => a.label.localeCompare(b.label, locale))}
          useCases={useCases.map((u) => ({ value: u.slug, label: pick(u.name, locale), category: u.categorySlug }))}
          integrations={integrations.map((i) => ({ value: i.slug, label: i.name }))}
          countries={countryChoices(locale)}
          languages={languageChoices(locale)}
        />
      )}

      {tab === "evidence" && <Evidence app={app} registry={registry} t={t} locale={locale} />}
      {tab === "pricing" && <Pricing app={app} t={t} locale={locale} />}
      {tab === "details" && <Details app={app} t={t} locale={locale} />}

      {tab === "updates" && (
        <div className="space-y-4">
          <Card title={d.updates.add}>{verified ? <UpdateForm appId={app.id} /> : <p className="text-sm text-muted-foreground">{d.ownerOnly}</p>}</Card>
          <Card title={d.updates.title}>
            {app.updates.length ? (
              <ul className="divide-y divide-border/70">
                {app.updates.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium">{u.title}</span>
                    <span className="text-xs text-muted-foreground">{(t.app.updateKinds as Record<string, string>)[u.kind] ?? u.kind} · {formatDate(locale, u.publishedAt ?? u.createdAt)}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{(d.updateStatus as Record<string, string>)[u.status] ?? u.status}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">{d.updatesNone}</p>}
          </Card>
        </div>
      )}

      {tab === "launches" && settings.features.launches && (
        <div className="space-y-4">
          <Card title={d.launch.title} body={d.launch.body}>
            {app.launches.length ? (
              <ul className="divide-y divide-border/70">
                {app.launches.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                    <span className="min-w-0 flex-1"><span className="font-medium">{l.headline}</span>
                      <span className="block text-xs text-muted-foreground">{formatDate(locale, l.launchDate)}{l.status === "approved" && l.windowEnd ? ` · ${fmt(d.launch.windowUntil, { date: formatDate(locale, l.windowEnd) })}` : ""}{l.moderationNote ? ` · ${l.moderationNote}` : ""}</span></span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{launchStatus[l.status] ?? l.status}</span>
                    {l.status === "approved" && <Link href={`/launches/${l.slug}`} className="text-sm font-medium text-brand hover:underline">{d.launch.view}</Link>}
                    {(l.status === "pending" || l.status === "draft") && <CancelLaunchButton id={l.id} />}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">{d.launch.none}</p>}
          </Card>
          {!activeLaunch && <Card title={t.launches.form.title}>{verified && app.status === "published" ? <LaunchForm appId={app.id} minDate={today} /> : <p className="text-sm text-muted-foreground">{t.launches.form.ownerOnly}</p>}</Card>}
        </div>
      )}

      {tab === "plan" && (
        <Card title={d.plan.title}>
          <p className="text-sm"><span className="text-muted-foreground">{d.plan.current}:</span> <strong>{app.entitlements.length ? app.entitlements.map((e) => pick(plans.find((p) => p.slug === e.plan)?.name, locale, e.plan)).join(", ") : d.plan.basic}</strong></p>
          {!settings.monetizationEnforced && <p className="mt-2 rounded-xl bg-accent/50 p-3 text-sm">{d.plan.betaNote}</p>}
          <h3 className="mt-5 text-sm font-semibold">{d.plan.entitlements}</h3>
          {app.entitlements.length ? (
            <ul className="mt-2 space-y-1 text-sm">
              {app.entitlements.map((e) => <li key={e.id}>{pick(plans.find((p) => p.slug === e.plan)?.name, locale, e.plan)} · {e.appWide ? fmt(d.plan.app, { name: app.name }) : d.plan.account} · {fmt(d.plan.granted, { date: formatDate(locale, e.startsAt) })}{e.endsAt ? ` · ${fmt(d.plan.until, { date: formatDate(locale, e.endsAt) })}` : ""}</li>)}
            </ul>
          ) : <p className="mt-2 text-sm text-muted-foreground">{d.plan.none}</p>}
          <Link href="/pricing" className="mt-4 inline-block text-sm font-medium text-brand hover:underline">{t.footer.links.pricing}</Link>
        </Card>
      )}
    </PageShell>
    </I18nScope>
  )
}
