"use client"

import { useState } from "react"
import { Loader2, RefreshCw, Trash2 } from "lucide-react"
import { Field, SelectInput, TextArea, TextInput, type Choice } from "@/components/form/fields"
import { Button } from "@/components/ui/button"
import { useAction } from "./use-action"
import { addDetail, addStatement, cancelLaunch, publishUpdate, removeDetail, requestRecheck, retractStatement, savePricingPlan, submitLaunch } from "@/actions/maker"
import { useI18n } from "@/i18n/client"
import { fmt } from "@/i18n/format"
import { CURRENCIES, REGIONS } from "@/lib/v2/options"

const grid = "grid gap-4 sm:grid-cols-2"

function CountrySelect({ value, onChange, label, none, countries }: { value: string; onChange: (v: string) => void; label: string; none: string; countries: Choice[] }) {
  return (
    <Field label={label}>
      <SelectInput value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{none}</option>
        {countries.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </SelectInput>
    </Field>
  )
}

export function RecheckButton({ appId }: { appId: string }) {
  const { t } = useI18n("dashboard", "submit", "launches")
  const { pending, run } = useAction()
  const [result, setResult] = useState<string | null>(null)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" className="rounded-full" disabled={pending} onClick={() => run(async () => {
        const r = await requestRecheck(appId)
        if (r.ok) setResult(r.data?.checked ? fmt(t.dashboard.recheckResult, { found: r.data.found, checked: r.data.checked }) : t.dashboard.recheckQueued)
        return r
      }, { success: "" })}>{pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{t.dashboard.requestRecheck}</Button>
      {result && <span role="status" className="text-sm text-muted-foreground">{result}</span>}
    </div>
  )
}

export function RemoveButton({ kind, appId, id, label }: { kind: "data_location" | "subprocessor" | "ai_provider" | "pricing_plan" | "alternative"; appId: string; id: string; label: string }) {
  const { pending, run } = useAction()
  return <button type="button" disabled={pending} aria-label={label} title={label} className="text-muted-foreground hover:text-destructive disabled:opacity-50" onClick={() => run(() => removeDetail({ kind, appId, id }))}><Trash2 className="size-4" /></button>
}

export function RetractButton({ id }: { id: string }) {
  const { t } = useI18n("dashboard", "submit", "launches")
  const { pending, run } = useAction()
  return <Button size="sm" variant="ghost" className="rounded-full" disabled={pending} onClick={() => run(() => retractStatement(id), { success: t.dashboard.evidence.retracted })}>{t.dashboard.evidence.retract}</Button>
}

/** The answers are spelled out per fact ("No training on customer data"), so a yes can never be read as its opposite. */
export function StatementForm({ appId, facts }: { appId: string; facts: (Choice & { valueType: string; yes: string; no: string })[] }) {
  const { t } = useI18n("dashboard", "submit", "launches")
  const e = t.dashboard.evidence, s = t.dashboard.statement
  const { pending, run } = useAction()
  const empty = { attribute: "", state: "yes", value: "", sourceUrl: "", excerpt: "" }
  const [v, setV] = useState(empty)
  const selected = facts.find((f) => f.value === v.attribute)
  const isDocument = selected?.valueType === "url"
  return (
    <form className="space-y-4" onSubmit={(ev) => { ev.preventDefault(); run(() => addStatement({ appId, attribute: v.attribute, state: v.state as "yes" | "no", value: v.value, sourceUrl: v.sourceUrl, excerpt: v.excerpt }), { after: () => setV(empty), success: e.saved }) }}>
      <p className="text-sm text-muted-foreground">{s.hint}</p>
      <div className={grid}>
        <Field label={e.attribute}>
          <SelectInput required value={v.attribute} onChange={(ev) => setV({ ...v, attribute: ev.target.value })}>
            <option value="" disabled>{s.choose}</option>
            {facts.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </SelectInput>
        </Field>
        <Field label={e.state}>
          <SelectInput value={v.state} disabled={!selected} onChange={(ev) => setV({ ...v, state: ev.target.value })}><option value="yes">{selected?.yes ?? s.answers.yes}</option><option value="no">{selected?.no ?? s.answers.no}</option></SelectInput>
        </Field>
        <Field label={e.sourceUrl} hint={e.sourceUrlHelp} optional={isDocument && v.state === "yes" ? t.common.required : t.common.optional} className={isDocument ? "sm:col-span-2" : undefined}>
          <TextInput type="url" inputMode="url" maxLength={500} placeholder="https://" required={isDocument && v.state === "yes"} value={v.sourceUrl} onChange={(ev) => setV({ ...v, sourceUrl: ev.target.value })} />
        </Field>
        {!isDocument && <Field label={e.value} hint={s.valueHint} optional={t.common.optional}><TextInput maxLength={500} value={v.value} onChange={(ev) => setV({ ...v, value: ev.target.value })} /></Field>}
      </div>
      <Field label={e.excerpt}><TextArea rows={2} maxLength={1000} value={v.excerpt} onChange={(ev) => setV({ ...v, excerpt: ev.target.value })} /></Field>
      <Button type="submit" className="rounded-full" disabled={pending || !v.attribute}>{e.submit}</Button>
    </form>
  )
}

export function PlanForm({ appId }: { appId: string }) {
  const { t } = useI18n("dashboard", "submit", "launches")
  const p = t.dashboard.pricingForm
  const { pending, run } = useAction()
  const empty = { name: "", billingInterval: "month", price: "", currency: "EUR", perUser: false, description: "", sourceUrl: "" }
  const [v, setV] = useState(empty)
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault()
      const price = v.price.trim() === "" ? null : Number(v.price.replace(",", "."))
      run(() => savePricingPlan({ appId, name: v.name, billingInterval: v.billingInterval as "month", price: price !== null && Number.isFinite(price) ? price : null, currency: v.currency as "EUR", perUser: v.perUser, description: v.description, sourceUrl: v.sourceUrl }), { after: () => setV(empty) })
    }}>
      <div className={grid}>
        <Field label={p.name}><TextInput required maxLength={60} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <Field label={p.interval}>
          <SelectInput value={v.billingInterval} onChange={(e) => setV({ ...v, billingInterval: e.target.value })}>
            {(["free", "month", "year", "one_time", "usage", "custom"] as const).map((i) => <option key={i} value={i}>{t.app.intervals[i]}</option>)}
          </SelectInput>
        </Field>
        {v.billingInterval !== "free" && (
          <Field label={p.price} optional={t.common.optional}>
            <div className="flex gap-2">
              <TextInput inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" maxLength={10} value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} className="flex-1" />
              <SelectInput value={v.currency} aria-label={t.dashboard.currency} onChange={(e) => setV({ ...v, currency: e.target.value })} className="w-24">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</SelectInput>
            </div>
          </Field>
        )}
        <label className="flex items-center gap-2.5 self-end pb-3 text-sm"><input type="checkbox" checked={v.perUser} onChange={(e) => setV({ ...v, perUser: e.target.checked })} className="size-4 rounded border-border accent-[var(--brand)]" />{p.perUser}</label>
        <Field label={p.description} optional={t.common.optional}><TextInput maxLength={300} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
        <Field label={p.sourceUrl} optional={t.common.optional}><TextInput type="url" maxLength={500} placeholder="https://" value={v.sourceUrl} onChange={(e) => setV({ ...v, sourceUrl: e.target.value })} /></Field>
      </div>
      <Button type="submit" variant="outline" className="rounded-full" disabled={pending}>{p.add}</Button>
    </form>
  )
}

export function DetailForm({ appId, kind, countries }: { appId: string; kind: "data_location" | "subprocessor" | "ai_provider" | "alternative"; countries: Choice[] }) {
  const { t } = useI18n("dashboard", "submit", "launches")
  const d = t.dashboard.details
  const { pending, run } = useAction()
  const empty = { region: "eu", countryCode: "", description: "", isDefault: false, name: "", purpose: "", provider: "", modelName: "", sourceUrl: "" }
  const [v, setV] = useState(empty)
  const submit = () => {
    const base = { appId, sourceUrl: v.sourceUrl }
    if (kind === "data_location") return addDetail({ ...base, kind, region: v.region as (typeof REGIONS)[number], countryCode: v.countryCode, description: v.description, isDefault: v.isDefault })
    if (kind === "subprocessor") return addDetail({ ...base, kind, name: v.name, purpose: v.purpose, countryCode: v.countryCode })
    if (kind === "ai_provider") return addDetail({ ...base, kind, provider: v.provider, modelName: v.modelName, purpose: v.purpose })
    return addDetail({ ...base, kind, name: v.name })
  }
  const label = { data_location: d.addLocation, subprocessor: d.addSubprocessor, ai_provider: d.addAiProvider, alternative: d.addAlternative }[kind]
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(submit, { after: () => setV(empty) }) }}>
      <div className={grid}>
        {kind === "data_location" && <>
          <Field label={d.region}><SelectInput value={v.region} onChange={(e) => setV({ ...v, region: e.target.value })}>{REGIONS.map((r) => <option key={r} value={r}>{t.app.regions[r]}</option>)}</SelectInput></Field>
          <CountrySelect label={d.country} none={t.submit.notStated} countries={countries} value={v.countryCode} onChange={(countryCode) => setV({ ...v, countryCode })} />
          <Field label={d.description} optional={t.common.optional}><TextInput maxLength={300} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
          <label className="flex items-center gap-2.5 self-end pb-3 text-sm"><input type="checkbox" checked={v.isDefault} onChange={(e) => setV({ ...v, isDefault: e.target.checked })} className="size-4 rounded border-border accent-[var(--brand)]" />{d.isDefault}</label>
        </>}
        {kind === "subprocessor" && <>
          <Field label={d.name}><TextInput required maxLength={120} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
          <CountrySelect label={d.country} none={t.submit.notStated} countries={countries} value={v.countryCode} onChange={(countryCode) => setV({ ...v, countryCode })} />
          <Field label={d.purpose} optional={t.common.optional}><TextInput maxLength={200} value={v.purpose} onChange={(e) => setV({ ...v, purpose: e.target.value })} /></Field>
        </>}
        {kind === "ai_provider" && <>
          <Field label={d.provider}><TextInput required maxLength={80} value={v.provider} onChange={(e) => setV({ ...v, provider: e.target.value })} /></Field>
          <Field label={d.model} optional={t.common.optional}><TextInput maxLength={120} value={v.modelName} onChange={(e) => setV({ ...v, modelName: e.target.value })} /></Field>
          <Field label={d.purpose} optional={t.common.optional}><TextInput maxLength={200} value={v.purpose} onChange={(e) => setV({ ...v, purpose: e.target.value })} /></Field>
        </>}
        {kind === "alternative" && <Field label={d.alternativeName} hint={d.alternativeHint}><TextInput required maxLength={80} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>}
        <Field label={d.sourceUrl} optional={t.common.optional}><TextInput type="url" maxLength={500} placeholder="https://" value={v.sourceUrl} onChange={(e) => setV({ ...v, sourceUrl: e.target.value })} /></Field>
      </div>
      <Button type="submit" variant="outline" className="rounded-full" disabled={pending}>{label}</Button>
    </form>
  )
}

export function UpdateForm({ appId }: { appId: string }) {
  const { t } = useI18n("dashboard", "submit", "launches")
  const u = t.dashboard.updates
  const { pending, run } = useAction()
  const empty = { kind: "feature", title: "", body: "", version: "", linkUrl: "" }
  const [v, setV] = useState(empty)
  const send = (draft: boolean) => run(() => publishUpdate({ appId, kind: v.kind as "feature", title: v.title, body: v.body, version: v.version, linkUrl: v.linkUrl, draft }), { after: () => setV(empty), success: draft ? undefined : u.published })
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); send(false) }}>
      <div className={grid}>
        <Field label={u.kind}>
          <SelectInput value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>
            {(["feature", "major", "pricing", "integration", "launch", "fix", "other"] as const).map((k) => <option key={k} value={k}>{t.app.updateKinds[k]}</option>)}
          </SelectInput>
        </Field>
        <Field label={u.version} optional={t.common.optional}><TextInput maxLength={40} value={v.version} onChange={(e) => setV({ ...v, version: e.target.value })} /></Field>
      </div>
      <Field label={u.updateTitle}><TextInput required minLength={3} maxLength={140} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
      <Field label={u.body} optional={t.common.optional}><TextArea rows={4} maxLength={5000} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} /></Field>
      <Field label={u.link} optional={t.common.optional}><TextInput type="url" maxLength={500} placeholder="https://" value={v.linkUrl} onChange={(e) => setV({ ...v, linkUrl: e.target.value })} /></Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="rounded-full" disabled={pending}>{u.publish}</Button>
        <Button type="button" variant="ghost" className="rounded-full" disabled={pending || v.title.length < 3} onClick={() => send(true)}>{u.draft}</Button>
      </div>
    </form>
  )
}

export function LaunchForm({ appId, minDate }: { appId: string; minDate: string }) {
  const { t } = useI18n("dashboard", "submit", "launches")
  const f = t.launches.form
  const { pending, run } = useAction()
  const [v, setV] = useState({ headline: "", description: "", headlineDe: "", descriptionDe: "", launchDate: minDate })
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(() => submitLaunch({ appId, ...v }), { success: f.done }) }}>
      <Field label={f.headline} hint={f.headlineHelp}><TextInput required minLength={5} maxLength={120} value={v.headline} onChange={(e) => setV({ ...v, headline: e.target.value })} /></Field>
      <Field label={f.description} optional={t.common.optional}><TextArea rows={4} maxLength={2000} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
      <div className={grid}>
        <Field label={f.headlineDe} optional={t.common.optional}><TextInput maxLength={120} lang="de" value={v.headlineDe} onChange={(e) => setV({ ...v, headlineDe: e.target.value })} /></Field>
        <Field label={f.date}><TextInput type="date" required min={minDate} value={v.launchDate} onChange={(e) => setV({ ...v, launchDate: e.target.value })} /></Field>
      </div>
      <Field label={f.descriptionDe} optional={t.common.optional}><TextArea rows={3} maxLength={2000} lang="de" value={v.descriptionDe} onChange={(e) => setV({ ...v, descriptionDe: e.target.value })} /></Field>
      <Button type="submit" className="rounded-full" disabled={pending}>{f.submit}</Button>
    </form>
  )
}

export function CancelLaunchButton({ id }: { id: string }) {
  const { t } = useI18n("dashboard", "submit", "launches")
  const { pending, run } = useAction()
  return <Button size="sm" variant="ghost" className="rounded-full" disabled={pending} onClick={() => run(() => cancelLaunch(id))}>{t.dashboard.launch.cancel}</Button>
}
