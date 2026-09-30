"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Field, SelectInput, TextArea, TextInput } from "@/components/form/fields"
import { Button } from "@/components/ui/button"
import {
  adminAction, adminSetFact, createCampaign, decideLaunch, grantEntitlement, mergeDuplicate, moderateRequest, reassignOwner, reviewEvidence,
  revokeEntitlement, revokeOwnership, runVerification, saveFeatures, saveOperator, setCampaignStatus, setRole,
} from "@/actions/admin"
import type { ActionResult } from "@/lib/types"

/** The admin area is English only (see docs/PWANOVA_V2_ARCHITECTURE.md). */
type Run = () => Promise<ActionResult>

function useRun() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (fn: Run, after?: () => void) => start(async () => {
    const r = await fn()
    if (r.ok) { toast.success(r.message ?? "Done."); after?.(); router.refresh() } else toast.error(r.error)
  })
  return { pending, run }
}

/** Asks for the reason that goes into the audit log. Returns null when the moderator cancels. */
function askReason(label: string, required: boolean): string | null {
  const input = window.prompt(`${label}\n\nReason${required ? " (required, recorded in the audit log)" : " (optional)"}:`)
  if (input === null) return null
  const reason = input.trim()
  if (required && reason.length < 3) { toast.error("A reason of at least three characters is required."); return null }
  return reason
}

export type AdminCommand =
  | { type: "moderate"; kind: Parameters<typeof adminAction>[0]["kind"]; id: string }
  | { type: "evidence"; decision: "approve" | "reject" | "retract"; id: string }
  | { type: "launch"; decision: "approve" | "reject"; id: string }
  | { type: "request"; decision: "hide" | "restore" | "close"; id: string }
  | { type: "verify"; id: string }
  | { type: "revokeOwnership"; id: string }
  | { type: "revokeEntitlement"; id: string }
  | { type: "campaign"; status: "draft" | "active" | "paused" | "ended"; id: string }

const NEEDS_REASON = (c: AdminCommand) =>
  (c.type === "moderate" && ["reject", "hide", "suspend", "remove_review"].includes(c.kind)) || (c.type === "evidence") || (c.type === "launch" && c.decision === "reject")
  || c.type === "request" || c.type === "revokeOwnership" || c.type === "revokeEntitlement"

export function AdminButton({ command, label, danger }: { command: AdminCommand; label: string; danger?: boolean }) {
  const { pending, run } = useRun()
  return (
    <Button size="sm" variant={danger ? "destructive" : "outline"} disabled={pending} onClick={() => {
      let reason = ""
      if (NEEDS_REASON(command)) {
        const input = askReason(label, true)
        if (input === null) return
        reason = input
      } else if (danger && !window.confirm(`${label}?`)) return
      const c = command
      run(() => {
        switch (c.type) {
          case "moderate": return adminAction({ kind: c.kind, id: c.id, reason: reason || undefined })
          case "evidence": return reviewEvidence({ evidenceId: c.id, decision: c.decision, note: reason })
          case "launch": return decideLaunch({ launchId: c.id, decision: c.decision, note: reason || undefined })
          case "request": return moderateRequest({ requestId: c.id, decision: c.decision, note: reason })
          case "verify": return runVerification(c.id)
          case "revokeOwnership": return revokeOwnership(c.id, reason)
          case "revokeEntitlement": return revokeEntitlement(c.id, reason)
          case "campaign": return setCampaignStatus(c.id, c.status)
        }
      })
    }}>{label}</Button>
  )
}

const row = "flex flex-wrap items-end gap-2"
const small = "h-9 w-auto min-w-0 text-xs"

export function ReassignOwnerForm({ appId }: { appId: string }) {
  const { pending, run } = useRun()
  const [username, setUsername] = useState("")
  return (
    <form className={row} onSubmit={(e) => {
      e.preventDefault()
      const reason = askReason(`Reassign ownership to ${username}`, true)
      if (reason !== null) run(() => reassignOwner({ appId, targetUsername: username.trim(), reason }), () => setUsername(""))
    }}>
      <TextInput required minLength={3} maxLength={32} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="new owner's username" aria-label="New owner's username" className={small} />
      <Button size="sm" type="submit" variant="outline" disabled={pending}>Reassign owner</Button>
    </form>
  )
}

export function MergeForm({ duplicateId }: { duplicateId: string }) {
  const { pending, run } = useRun()
  const [slug, setSlug] = useState("")
  return (
    <form className={row} onSubmit={(e) => {
      e.preventDefault()
      const reason = askReason(`Merge this listing into "${slug}". Saves and follows move; this listing leaves the catalogue.`, true)
      if (reason !== null) run(() => mergeDuplicate({ duplicateId, targetSlug: slug.trim(), reason }), () => setSlug(""))
    }}>
      <TextInput required pattern="[a-z0-9-]+" maxLength={80} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug of the listing that stays" aria-label="Slug of the listing that stays" className={small} />
      <Button size="sm" type="submit" variant="outline" disabled={pending}>Merge as duplicate</Button>
    </form>
  )
}

export function SetFactForm({ apps, facts }: { apps: { id: string; name: string }[]; facts: { key: string; label: string; yes: string; no: string }[] }) {
  const { pending, run } = useRun()
  const empty = { appId: "", key: "", state: "yes", value: "", sourceUrl: "", sourceTitle: "", excerpt: "", reason: "" }
  const [v, setV] = useState(empty)
  const fact = facts.find((f) => f.key === v.key)
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => adminSetFact({ ...v, state: v.state as "yes" | "no" | "unknown" }), () => setV({ ...empty, appId: v.appId })) }}>
      <Field label="Listing"><SelectInput required value={v.appId} onChange={(e) => setV({ ...v, appId: e.target.value })}><option value="" disabled>Choose</option>{apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</SelectInput></Field>
      <Field label="Fact"><SelectInput required value={v.key} onChange={(e) => setV({ ...v, key: e.target.value })}><option value="" disabled>Choose</option>{facts.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</SelectInput></Field>
      <Field label="Answer" hint="“Not verified” withdraws the reviewed answer. It never records a no.">
        <SelectInput value={v.state} onChange={(e) => setV({ ...v, state: e.target.value })}><option value="yes">{fact?.yes ?? "Yes"}</option><option value="no">{fact?.no ?? "No"}</option><option value="unknown">Not verified</option></SelectInput>
      </Field>
      <Field label="Value" optional="optional"><TextInput maxLength={500} value={v.value} onChange={(e) => setV({ ...v, value: e.target.value })} /></Field>
      <Field label="Source URL" hint="The page or document you read."><TextInput type="url" maxLength={500} placeholder="https://" required={v.state !== "unknown"} value={v.sourceUrl} onChange={(e) => setV({ ...v, sourceUrl: e.target.value })} /></Field>
      <Field label="Source title" optional="optional"><TextInput maxLength={200} value={v.sourceTitle} onChange={(e) => setV({ ...v, sourceTitle: e.target.value })} /></Field>
      <Field label="Relevant wording" optional="optional" className="sm:col-span-2"><TextArea rows={2} maxLength={1000} value={v.excerpt} onChange={(e) => setV({ ...v, excerpt: e.target.value })} /></Field>
      <Field label="Reason" hint="Recorded in the audit log." className="sm:col-span-2"><TextInput required minLength={3} maxLength={500} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} /></Field>
      <div className="sm:col-span-2"><Button type="submit" disabled={pending}>Record reviewed answer</Button></div>
    </form>
  )
}

export function GrantForm({ plans }: { plans: { slug: string; name: string }[] }) {
  const { pending, run } = useRun()
  const empty = { username: "", plan: plans[0]?.slug ?? "", appSlug: "", endsAt: "", note: "" }
  const [v, setV] = useState(empty)
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => grantEntitlement({ ...v, appSlug: v.appSlug || undefined, endsAt: v.endsAt || undefined }), () => setV(empty)) }}>
      <Field label="Username"><TextInput required minLength={3} maxLength={32} value={v.username} onChange={(e) => setV({ ...v, username: e.target.value })} /></Field>
      <Field label="Plan"><SelectInput value={v.plan} onChange={(e) => setV({ ...v, plan: e.target.value })}>{plans.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</SelectInput></Field>
      <Field label="Listing slug" optional="optional" hint="Empty: the plan applies to the account."><TextInput pattern="[a-z0-9-]*" maxLength={80} value={v.appSlug} onChange={(e) => setV({ ...v, appSlug: e.target.value })} /></Field>
      <Field label="Ends on" optional="optional"><TextInput type="date" value={v.endsAt} onChange={(e) => setV({ ...v, endsAt: e.target.value })} /></Field>
      <Field label="Note" hint="Recorded in the audit log. Nothing is charged by this action." className="sm:col-span-2"><TextInput required minLength={3} maxLength={500} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></Field>
      <div className="sm:col-span-2"><Button type="submit" disabled={pending}>Grant entitlement</Button></div>
    </form>
  )
}

export interface Features { launches: boolean; requests: boolean; compare: boolean; newsletter: boolean; sponsorship: boolean }
const FEATURE_HELP: Record<keyof Features, string> = {
  launches: "Launch pages, the launch list and launch submissions.",
  requests: "Software requests, matching and vendor responses.",
  compare: "Comparison pages, the tray and the compare buttons.",
  newsletter: "The newsletter sign-up in the footer. Sending is not connected.",
  sponsorship: "Labelled sponsor placements. Switched off, no campaign is shown.",
}
export function FeaturesForm({ initial }: { initial: Features }) {
  const { pending, run } = useRun()
  const [v, setV] = useState(initial)
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => saveFeatures(v)) }}>
      {(Object.keys(FEATURE_HELP) as (keyof Features)[]).map((k) => (
        <label key={k} className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.checked })} className="mt-0.5 size-4 rounded border-border accent-[var(--brand)]" />
          <span><span className="font-medium capitalize">{k}</span><span className="block text-muted-foreground">{FEATURE_HELP[k]}</span></span>
        </label>
      ))}
      <Button type="submit" disabled={pending}>Save features</Button>
    </form>
  )
}

const OPERATOR_FIELDS = [
  ["legal_name", "Legal name (person or company)"], ["represented_by", "Represented by"], ["street", "Street and number"], ["postal_code", "Postal code"], ["city", "City"],
  ["country", "Country"], ["email", "Contact e-mail"], ["phone", "Phone"], ["register", "Register entry (court and number)"], ["vat_id", "VAT ID"],
  ["responsible_for_content", "Responsible for content (name and address)"],
] as const
type OperatorKey = (typeof OPERATOR_FIELDS)[number][0]
export function OperatorForm({ initial }: { initial: Record<OperatorKey, string | null> }) {
  const { pending, run } = useRun()
  const [v, setV] = useState(Object.fromEntries(OPERATOR_FIELDS.map(([k]) => [k, initial[k] ?? ""])) as Record<OperatorKey, string>)
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => saveOperator(v)) }}>
      {OPERATOR_FIELDS.map(([k, label]) => <Field key={k} label={label}><TextInput maxLength={200} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>)}
      <p className="text-sm text-muted-foreground sm:col-span-2">These details are published on the legal notice and the privacy page. Until name, address and e-mail are entered, both pages show a notice and are kept out of search engines.</p>
      <div className="sm:col-span-2"><Button type="submit" disabled={pending}>Save operator details</Button></div>
    </form>
  )
}

export function CampaignForm({ categories }: { categories: { slug: string; name: string }[] }) {
  const { pending, run } = useRun()
  const empty = { sponsorName: "", appSlug: "", placement: "category", categorySlug: categories[0]?.slug ?? "", headlineEn: "", headlineDe: "", startsAt: "", endsAt: "" }
  const [v, setV] = useState(empty)
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => createCampaign({ ...v, placement: v.placement as "home" }), () => setV(empty)) }}>
      <Field label="Sponsor"><TextInput required maxLength={120} value={v.sponsorName} onChange={(e) => setV({ ...v, sponsorName: e.target.value })} /></Field>
      <Field label="Listing slug"><TextInput required pattern="[a-z0-9-]+" maxLength={80} value={v.appSlug} onChange={(e) => setV({ ...v, appSlug: e.target.value })} /></Field>
      <Field label="Placement"><SelectInput value={v.placement} onChange={(e) => setV({ ...v, placement: e.target.value })}>{["home", "category", "discover", "launches"].map((p) => <option key={p}>{p}</option>)}</SelectInput></Field>
      {v.placement === "category" && <Field label="Category"><SelectInput value={v.categorySlug} onChange={(e) => setV({ ...v, categorySlug: e.target.value })}>{categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</SelectInput></Field>}
      <Field label="Line shown with the placement (English)" optional="optional"><TextInput maxLength={120} value={v.headlineEn} onChange={(e) => setV({ ...v, headlineEn: e.target.value })} /></Field>
      <Field label="Line shown with the placement (German)" optional="optional"><TextInput maxLength={120} lang="de" value={v.headlineDe} onChange={(e) => setV({ ...v, headlineDe: e.target.value })} /></Field>
      <Field label="Starts"><TextInput type="date" required value={v.startsAt} onChange={(e) => setV({ ...v, startsAt: e.target.value })} /></Field>
      <Field label="Ends"><TextInput type="date" required value={v.endsAt} onChange={(e) => setV({ ...v, endsAt: e.target.value })} /></Field>
      <p className="text-sm text-muted-foreground sm:col-span-2">A campaign is created as a draft. It is shown only while it is active, inside its dates, and while sponsorship is switched on. It is always labelled and never part of the organic list.</p>
      <div className="sm:col-span-2"><Button type="submit" disabled={pending}>Create campaign</Button></div>
    </form>
  )
}

export function RoleForm() {
  const { pending, run } = useRun()
  const [v, setV] = useState({ username: "", role: "moderator" })
  return (
    <form className={row} onSubmit={(e) => { e.preventDefault(); run(() => setRole({ username: v.username.trim(), role: v.role as "moderator" }), () => setV({ ...v, username: "" })) }}>
      <TextInput required minLength={3} maxLength={32} value={v.username} onChange={(e) => setV({ ...v, username: e.target.value })} placeholder="username" aria-label="Username" className="h-10 w-48" />
      <SelectInput value={v.role} aria-label="Role" onChange={(e) => setV({ ...v, role: e.target.value })} className="h-10 w-40">{["moderator", "developer", "user"].map((r) => <option key={r}>{r}</option>)}</SelectInput>
      <Button type="submit" disabled={pending}>Set role</Button>
    </form>
  )
}
