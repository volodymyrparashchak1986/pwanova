import type { Metadata } from "next"
import { AdminButton, CampaignForm, FeaturesForm, GrantForm, MergeForm, OperatorForm, ReassignOwnerForm, RoleForm, SetFactForm } from "@/components/admin/admin-tools"
import { PageShell } from "@/components/app/section-header"
import { Link } from "@/components/i18n/link"
import { SourceLink } from "@/components/trust/fact-row"
import { formatDate, pick, relativeTime } from "@/i18n/format"
import { getI18n } from "@/i18n/server"
import { requireModerator } from "@/lib/auth"
import {
  getAdminApps, getAdminCampaigns, getAdminCounts, getAdminEntitlements, getAdminLaunches, getAdminReports, getAdminRequests, getAuditLog, getNewsletterCount, getPendingEvidence,
} from "@/lib/data/admin"
import { getCategories, getFactRegistry, getPlans, getPublicSettings } from "@/lib/data/catalog"
import { factLabel } from "@/lib/v2/trust"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } }

/**
 * The admin area is English only. Every decision here is checked again by the database (role, reason)
 * and leaves an audit entry with the previous and the new value.
 */
const TABS = [["queue", "Review queue"], ["reports", "Reports"], ["listings", "Listings"], ["evidence", "Evidence"], ["requests", "Requests"], ["plans", "Plans"], ["settings", "Settings"], ["audit", "Audit log"]] as const
type Tab = (typeof TABS)[number][0]
const ADMIN_ONLY: Tab[] = ["plans", "settings", "audit"]

const Section = ({ title, body, children }: { title: string; body?: string; children: React.ReactNode }) => (
  <section className="mt-8"><h2 className="text-lg font-semibold">{title}</h2>{body && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{body}</p>}<div className="mt-4">{children}</div></section>
)
const Empty = ({ children }: { children: React.ReactNode }) => <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{children}</p>
const Item = ({ children }: { children: React.ReactNode }) => <li className="rounded-2xl border border-border bg-card p-4">{children}</li>
const Tag = ({ children }: { children: React.ReactNode }) => <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{children}</span>

export default async function AdminPage({ searchParams }: PageProps<"/[locale]/admin">) {
  const viewer = await requireModerator() // the page; every write is checked again by the database
  const [sp, { locale }] = await Promise.all([searchParams, getI18n()])
  const isAdmin = viewer.role === "admin"
  const requested = (TABS.map(([k]) => k) as string[]).includes(String(sp.tab)) ? (sp.tab as Tab) : "queue"
  const tab: Tab = !isAdmin && ADMIN_ONLY.includes(requested) ? "queue" : requested
  const counts = await getAdminCounts()
  const badge: Partial<Record<Tab, number>> = { queue: counts.apps + counts.launches, reports: counts.reports, evidence: counts.evidence }

  return (
    <PageShell wide>
      <h1 className="text-4xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">Signed in as {viewer.displayName} ({viewer.role}).</p>
      <nav className="no-scrollbar -mx-4 mt-6 flex gap-1 overflow-x-auto border-b border-border px-4" aria-label="Admin sections">
        {TABS.filter(([k]) => isAdmin || !ADMIN_ONLY.includes(k)).map(([k, label]) => (
          <Link key={k} href={`/admin${k === "queue" ? "" : `?tab=${k}`}`} aria-current={k === tab ? "page" : undefined}
            className={cn("-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap", k === tab ? "border-brand font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {label}{badge[k] ? <span className="grid min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white">{badge[k]}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === "queue" && <Queue isAdmin={isAdmin} locale={locale} />}
      {tab === "reports" && <Reports isAdmin={isAdmin} locale={locale} />}
      {tab === "listings" && <Listings isAdmin={isAdmin} />}
      {tab === "evidence" && <Evidence locale={locale} />}
      {tab === "requests" && <Requests locale={locale} />}
      {tab === "plans" && isAdmin && <Plans locale={locale} />}
      {tab === "settings" && isAdmin && <Settings locale={locale} />}
      {tab === "audit" && isAdmin && <Audit locale={locale} />}
    </PageShell>
  )
}

type L = { locale: "en" | "de" }

async function Queue({ isAdmin, locale }: L & { isAdmin: boolean }) {
  const [apps, launches] = await Promise.all([getAdminApps(300), getAdminLaunches()])
  const pending = apps.filter((a) => a.status === "pending")
  const waiting = launches.filter((l) => l.status === "pending")
  return (
    <>
      <Section title={`New listings (${pending.length})`} body="Publication and ownership are decided separately: approving a listing does not verify its owner, and a verified owner does not skip this queue. Run the checks before you decide.">
        {pending.length ? (
          <ul className="space-y-3">
            {pending.map((a) => (
              <Item key={a.id}>
                <p className="text-sm"><Link className="font-semibold hover:underline" href={`/apps/${a.slug}/claim`}>{a.name}</Link> <span className="text-muted-foreground">{a.domain} · submitted {relativeTime(locale, a.createdAt)}{a.owner ? ` by @${a.owner}` : ""}</span></p>
                <p className="mt-1 flex flex-wrap gap-1.5 text-xs"><Tag>{a.ownershipStatus.replaceAll("_", " ")}</Tag><Tag>{a.verificationState.replaceAll("_", " ")}</Tag><Tag>evidence {a.evidenceScore}%</Tag></p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <AdminButton command={{ type: "verify", id: a.id }} label="Run checks now" />
                  {isAdmin && <><AdminButton command={{ type: "moderate", kind: "approve", id: a.id }} label="Approve" /><AdminButton command={{ type: "moderate", kind: "reject", id: a.id }} label="Reject" danger /></>}
                </div>
                {isAdmin && <div className="mt-3"><MergeForm duplicateId={a.id} /></div>}
              </Item>
            ))}
          </ul>
        ) : <Empty>Nothing is waiting for review.</Empty>}
        {!isAdmin && pending.length > 0 && <p className="mt-3 text-sm text-muted-foreground">Approving and rejecting listings is an admin decision.</p>}
      </Section>

      <Section title={`Launches (${waiting.length})`} body="An approved launch is shown for 30 days from the approval. One launch per listing at a time.">
        {launches.length ? (
          <ul className="space-y-3">
            {launches.map((l) => (
              <Item key={l.id}>
                <p className="text-sm"><span className="font-semibold">{l.headline}</span> <span className="text-muted-foreground">· {l.app?.name} · {formatDate(locale, l.launchDate)}</span> <Tag>{l.status}</Tag></p>
                {l.description && <p className="mt-2 line-clamp-4 text-sm whitespace-pre-line text-muted-foreground">{l.description}</p>}
                {l.status === "pending" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <AdminButton command={{ type: "launch", decision: "approve", id: l.id }} label="Approve launch" />
                    <AdminButton command={{ type: "launch", decision: "reject", id: l.id }} label="Reject launch" danger />
                  </div>
                )}
              </Item>
            ))}
          </ul>
        ) : <Empty>No launches.</Empty>}
      </Section>
    </>
  )
}

async function Reports({ isAdmin, locale }: L & { isAdmin: boolean }) {
  const reports = await getAdminReports()
  return (
    <Section title={`Open reports (${reports.length})`} body="A low rating is never a reason to remove a review. Remove one only when it breaks the review rules.">
      {reports.length ? (
        <ul className="space-y-3">
          {reports.map((r) => (
            <Item key={r.id}>
              <p className="text-sm"><Tag>{r.reason.replaceAll("_", " ")}</Tag> <span className="text-muted-foreground">{relativeTime(locale, r.createdAt)}</span></p>
              {r.app && <p className="mt-2 text-sm">Listing: <Link className="font-semibold hover:underline" href={`/apps/${r.app.slug}`}>{r.app.name}</Link></p>}
              {r.evidence && <p className="mt-2 text-sm">Evidence: <span className="font-mono text-xs">{r.evidence.key}</span></p>}
              {r.launchId && <p className="mt-2 text-sm">Launch reported.</p>}
              {r.requestId && <p className="mt-2 text-sm">Software request reported.</p>}
              {r.review && <p className="mt-2 line-clamp-3 rounded-xl bg-muted p-3 text-sm">“{r.review.body}”</p>}
              {r.details && <p className="mt-2 text-sm text-muted-foreground">{r.details}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <AdminButton command={{ type: "moderate", kind: "resolve_report", id: r.id }} label="Resolve" />
                <AdminButton command={{ type: "moderate", kind: "dismiss_report", id: r.id }} label="Dismiss" />
                {r.review && <AdminButton command={{ type: "moderate", kind: "remove_review", id: r.review.id }} label="Hide review" danger />}
                {r.evidence && <AdminButton command={{ type: "evidence", decision: "retract", id: r.evidence.id }} label="Withdraw evidence" danger />}
                {r.requestId && <AdminButton command={{ type: "request", decision: "hide", id: r.requestId }} label="Hide request" danger />}
                {r.app && isAdmin && <AdminButton command={{ type: "moderate", kind: "hide", id: r.app.id }} label="Hide listing" danger />}
              </div>
            </Item>
          ))}
        </ul>
      ) : <Empty>No open reports.</Empty>}
    </Section>
  )
}

async function Listings({ isAdmin }: { isAdmin: boolean }) {
  const apps = (await getAdminApps(300)).filter((a) => !a.duplicateOf)
  return (
    <Section title={`Listings (${apps.length})`} body="Featuring marks an editor's pick. It is labelled and does not change the organic order.">
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs text-muted-foreground"><tr><th className="p-3">Listing</th><th className="p-3">Status</th><th className="p-3">Ownership</th><th className="p-3">Evidence</th><th className="p-3">Actions</th></tr></thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id} className="border-t border-border align-top">
                <td className="p-3"><Link href={a.status === "published" ? `/apps/${a.slug}` : `/apps/${a.slug}/claim`} className="font-medium hover:underline">{a.name}</Link>
                  <p className="text-xs text-muted-foreground">{a.domain}{a.owner ? ` · @${a.owner}` : ""}{a.isDemo ? " · demo" : ""}{a.isFeatured ? " · editor's pick" : ""}</p>
                  {a.moderationNote && <p className="mt-0.5 text-xs text-muted-foreground">Note: {a.moderationNote}</p>}</td>
                <td className="p-3">{a.status}</td>
                <td className="p-3">{a.ownershipStatus.replaceAll("_", " ")}</td>
                <td className="p-3">{a.verificationState.replaceAll("_", " ")}<span className="block text-xs text-muted-foreground">{a.evidenceScore}%</span></td>
                <td className="space-y-2 p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {!a.isDemo && <AdminButton command={{ type: "verify", id: a.id }} label="Run checks" />}
                    {isAdmin && (a.status !== "published"
                      ? <AdminButton command={{ type: "moderate", kind: a.status === "pending" ? "approve" : "restore", id: a.id }} label={a.status === "pending" ? "Approve" : "Restore"} />
                      : <AdminButton command={{ type: "moderate", kind: "hide", id: a.id }} label="Hide" danger />)}
                    {isAdmin && a.status !== "suspended" && <AdminButton command={{ type: "moderate", kind: "suspend", id: a.id }} label="Suspend" danger />}
                    {isAdmin && <AdminButton command={{ type: "moderate", kind: a.isFeatured ? "unfeature" : "feature", id: a.id }} label={a.isFeatured ? "Remove pick" : "Editor's pick"} />}
                    {isAdmin && a.ownershipStatus === "verified_owner" && <AdminButton command={{ type: "revokeOwnership", id: a.id }} label="Revoke ownership" danger />}
                  </div>
                  {isAdmin && a.ownershipStatus === "verified_owner" && <ReassignOwnerForm appId={a.id} />}
                  {isAdmin && <MergeForm duplicateId={a.id} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

async function Evidence({ locale }: L) {
  const [pending, registry, apps] = await Promise.all([getPendingEvidence(), getFactRegistry(), getAdminApps(300)])
  const label = (key: string) => pick(registry.find((a) => a.key === key)?.label, "en", key)
  const answer = (key: string, state: "yes" | "no" | "unknown") => { const a = registry.find((x) => x.key === key); return a && state !== "unknown" ? factLabel(a, state, "en") : state }
  return (
    <>
      <Section title={`Submissions waiting for review (${pending.length})`} body="Approve only after you opened the source and it supports the statement. An approved submission becomes “reviewed by PWANova”; a rejected one is never shown.">
        {pending.length ? (
          <ul className="space-y-3">
            {pending.map((e) => (
              <Item key={e.id}>
                <p className="text-sm"><span className="font-semibold">{label(e.key)}</span>: {answer(e.key, e.state)}{e.value ? ` · ${e.value}` : ""} <span className="text-muted-foreground">· {e.app?.name}{e.submitter ? ` · by @${e.submitter}` : ""} · {relativeTime(locale, e.collectedAt)}</span></p>
                <p className="mt-1 text-sm">{e.sourceUrl ? <SourceLink url={e.sourceUrl} label="Open source" /> : <span className="text-muted-foreground">No source given</span>}</p>
                {e.excerpt && <blockquote className="mt-2 border-l-2 border-border pl-3 text-sm text-muted-foreground">{e.excerpt}</blockquote>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <AdminButton command={{ type: "evidence", decision: "approve", id: e.id }} label="Approve (source checked)" />
                  <AdminButton command={{ type: "evidence", decision: "reject", id: e.id }} label="Reject" danger />
                </div>
              </Item>
            ))}
          </ul>
        ) : <Empty>No submissions are waiting.</Empty>}
      </Section>
      <Section title="Record a reviewed answer" body="Use this after reading a document yourself. The answer is stored as “reviewed by PWANova” with the source and your reason; the previous answer stays in the history.">
        <div className="rounded-2xl border border-border bg-card p-5"><SetFactForm apps={apps.filter((a) => !a.isDemo && !a.duplicateOf).map((a) => ({ id: a.id, name: a.name }))} facts={registry.map((a) => ({ key: a.key, label: pick(a.label, "en", a.key), yes: factLabel(a, "yes", "en"), no: factLabel(a, "no", "en") }))} /></div>
      </Section>
    </>
  )
}

async function Requests({ locale }: L) {
  const requests = await getAdminRequests()
  return (
    <Section title={`Software requests (${requests.length})`} body="Moderators see requirements, never contact details. Hide a request that contains personal data or is not a request for software.">
      {requests.length ? (
        <ul className="space-y-3">
          {requests.map((r) => (
            <Item key={r.id}>
              <p className="text-sm"><Link href={`/requests/${r.publicId}`} className="font-semibold hover:underline">{r.title}</Link> <Tag>{r.status}</Tag> <Tag>{r.visibility}</Tag> <span className="text-muted-foreground">{relativeTime(locale, r.createdAt)}</span></p>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{r.problem}</p>
              {r.moderationNote && <p className="mt-1 text-xs text-muted-foreground">Note: {r.moderationNote}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {r.status === "hidden"
                  ? <AdminButton command={{ type: "request", decision: "restore", id: r.id }} label="Restore" />
                  : <AdminButton command={{ type: "request", decision: "hide", id: r.id }} label="Hide" danger />}
                {r.status !== "closed" && r.status !== "hidden" && <AdminButton command={{ type: "request", decision: "close", id: r.id }} label="Close" />}
              </div>
            </Item>
          ))}
        </ul>
      ) : <Empty>No requests.</Empty>}
    </Section>
  )
}

async function Plans({ locale }: L) {
  const [plans, entitlements, settings] = await Promise.all([getPlans(), getAdminEntitlements(), getPublicSettings()])
  return (
    <>
      <Section title="Monetisation" body="There is no payment provider. Prices are stored in the database; an entitlement is granted here by hand and nothing is charged.">
        <p className="rounded-2xl border border-border bg-card p-4 text-sm">Enforcement is <strong>{settings.monetizationEnforced ? "on" : "off"}</strong>. {settings.monetizationEnforced ? "Paid capabilities need an active entitlement." : "During the beta every verified owner can use every maker tool."} It is changed in the database (site_settings, key “monetization”), together with a dated announcement.</p>
      </Section>
      <Section title="Grant an entitlement"><div className="rounded-2xl border border-border bg-card p-5"><GrantForm plans={plans.filter((p) => p.slug !== "basic").map((p) => ({ slug: p.slug, name: pick(p.name, "en", p.slug) }))} /></div></Section>
      <Section title={`Entitlements (${entitlements.length})`}>
        {entitlements.length ? (
          <ul className="space-y-2">
            {entitlements.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm">
                <span className="min-w-0 flex-1"><strong>{e.plan}</strong> · @{e.user ?? "?"}{e.app ? ` · ${e.app}` : " · account"} · since {formatDate(locale, e.startsAt)}{e.endsAt ? ` until ${formatDate(locale, e.endsAt)}` : ""}{e.note ? <span className="block text-xs text-muted-foreground">{e.note}</span> : null}</span>
                <Tag>{e.status}</Tag>
                {e.status === "active" && <AdminButton command={{ type: "revokeEntitlement", id: e.id }} label="Revoke" danger />}
              </li>
            ))}
          </ul>
        ) : <Empty>No entitlements have been granted.</Empty>}
      </Section>
    </>
  )
}

async function Settings({ locale }: L) {
  const [settings, campaigns, categories, subscribers] = await Promise.all([getPublicSettings(), getAdminCampaigns(), getCategories(), getNewsletterCount()])
  return (
    <>
      <Section title="Features"><div className="rounded-2xl border border-border bg-card p-5"><FeaturesForm initial={settings.features} /></div></Section>
      <Section title="Operator details" body="Required for the legal notice and the privacy page. Enter what applies to you; PWANova does not guess any of it.">
        <div className="rounded-2xl border border-border bg-card p-5"><OperatorForm initial={settings.operator} /></div>
      </Section>
      <Section title="Moderators" body="Moderators review evidence, launches, requests, reviews and reports. Publishing listings, plans and settings stay with admins."><RoleForm /></Section>
      <Section title="Sponsor campaigns" body={`Sponsorship is ${settings.features.sponsorship ? "switched on" : "switched off: no campaign is shown"}.`}>
        {campaigns.length > 0 && (
          <ul className="mb-5 space-y-2">
            {campaigns.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm">
                <span className="min-w-0 flex-1"><strong>{c.sponsor}</strong> · {c.app ?? "no listing"} · {c.placement}{c.category ? ` (${c.category})` : ""} · {formatDate(locale, c.startsAt)} – {formatDate(locale, c.endsAt)}</span>
                <Tag>{c.status}</Tag>
                {c.status !== "active" && c.status !== "ended" && <AdminButton command={{ type: "campaign", status: "active", id: c.id }} label="Activate" />}
                {c.status === "active" && <AdminButton command={{ type: "campaign", status: "paused", id: c.id }} label="Pause" />}
                {c.status !== "ended" && <AdminButton command={{ type: "campaign", status: "ended", id: c.id }} label="End" danger />}
              </li>
            ))}
          </ul>
        )}
        <div className="rounded-2xl border border-border bg-card p-5"><CampaignForm categories={categories.map((c) => ({ slug: c.slug, name: pick(c.name, "en", c.slug) }))} /></div>
      </Section>
      <Section title="Newsletter"><p className="rounded-2xl border border-border bg-card p-4 text-sm">{subscribers} active subscription{subscribers === 1 ? "" : "s"}, each stored with the wording and the time of the consent. No sending service is connected.</p></Section>
    </>
  )
}

async function Audit({ locale }: L) {
  const log = await getAuditLog(120)
  return (
    <Section title="Audit log" body="Append-only. Written by the database for every moderation decision, with the previous and the new value.">
      {log.length ? (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {log.map((e) => (
            <li key={e.id} className="p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">@{e.actor ?? "system"}</span>{e.role && <Tag>{e.role}</Tag>}
                <span className="font-mono text-xs">{e.action}</span><span className="text-muted-foreground">{e.targetType}{e.app ? ` · ${e.app}` : ""}</span>
                <time className="ml-auto text-xs text-muted-foreground" dateTime={e.createdAt}>{formatDate(locale, e.createdAt)} · {relativeTime(locale, e.createdAt)}</time>
              </div>
              {e.reason && <p className="mt-1 text-muted-foreground">{e.reason}</p>}
              {(e.previous != null || e.next != null) && (
                <details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">Previous and new value</summary>
                  <pre className="mt-1 overflow-x-auto rounded-lg bg-muted p-2">{JSON.stringify({ previous: e.previous, next: e.next }, null, 2)}</pre></details>
              )}
            </li>
          ))}
        </ul>
      ) : <Empty>No entries yet.</Empty>}
    </Section>
  )
}
