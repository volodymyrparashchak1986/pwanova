"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Lock } from "lucide-react"
import { CheckList, Field, Fieldset, SelectInput, TextArea, TextInput, type Choice } from "@/components/form/fields"
import { Button } from "@/components/ui/button"
import { createRequest, type RequestInput } from "@/actions/requests"
import { useI18n } from "@/i18n/client"
import { CURRENCIES } from "@/lib/v2/options"
import { cn } from "@/lib/utils"

const TEAM_SIZES = ["1", "2-10", "11-50", "51-200", "201-1000", "1000+"] as const
const TIMEFRAMES = ["asap", "1-3-months", "3-6-months", "exploring"] as const
const INTERVALS = ["month", "year", "one_time"] as const
const PLATFORMS = ["web", "pwa", "ios", "android", "macos", "windows", "linux", "browser_extension"] as const
const splitLines = (text: string) => text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length >= 2).slice(0, 10)

export function RequestForm({ categories, useCases, facts, integrations, countries, languages: languageList, defaults }: {
  categories: Choice[]; useCases: (Choice & { category: string | null })[]; facts: Choice[]; integrations: Choice[]; countries: Choice[]; languages: Choice[]
  defaults: { name: string; email: string }
}) {
  const { t, href } = useI18n("requests")
  const r = t.requests
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [v, setV] = useState({
    title: "", problem: "", teamSize: "", countryCode: "", budget: "", currency: "EUR", perUser: false, interval: "", timeframe: "", visibility: "private",
    mustHave: "", niceToHave: "", name: defaults.name, email: defaults.email, company: "", phone: "",
  })
  const [categoriesPicked, setCategories] = useState<string[]>([])
  const [useCasesPicked, setUseCases] = useState<string[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const [required, setRequired] = useState<string[]>([])
  const [integrationsPicked, setIntegrations] = useState<string[]>([])
  const [platforms, setPlatforms] = useState<string[]>([])
  const set = (patch: Partial<typeof v>) => setV((s) => ({ ...s, ...patch }))
  const offered = useCases.filter((u) => !categoriesPicked.length || (u.category && categoriesPicked.includes(u.category)))

  return (
    <form className="space-y-5" onSubmit={(e) => {
      e.preventDefault()
      setError(null)
      const budget = v.budget.trim() === "" ? null : Number(v.budget.replace(",", "."))
      const input: RequestInput = {
        title: v.title, problem: v.problem, teamSize: (v.teamSize || null) as RequestInput["teamSize"], countryCode: v.countryCode || null, languages,
        budgetMax: budget !== null && Number.isFinite(budget) ? budget : null, budgetCurrency: v.currency as RequestInput["budgetCurrency"], budgetPerUser: v.perUser,
        budgetInterval: (v.interval || null) as RequestInput["budgetInterval"], categories: categoriesPicked, useCases: useCasesPicked.filter((u) => offered.some((o) => o.value === u)),
        requiredFacts: required, requiredIntegrations: integrationsPicked, requiredPlatforms: platforms as RequestInput["requiredPlatforms"],
        mustHave: splitLines(v.mustHave), niceToHave: splitLines(v.niceToHave), timeframe: (v.timeframe || null) as RequestInput["timeframe"],
        visibility: v.visibility as RequestInput["visibility"], contact: { name: v.name, email: v.email, company: v.company, phone: v.phone },
      }
      start(async () => {
        const res = await createRequest(input)
        if (res.ok && res.data) router.push(href(`/requests/${res.data.id}`))
        else if (!res.ok) setError(res.error)
      })
    }}>
      <Fieldset legend={r.sectionNeed} hint={r.noContactInText}>
        <Field label={r.fields.title}><TextInput required minLength={8} maxLength={140} value={v.title} placeholder={r.fields.titlePlaceholder} onChange={(e) => set({ title: e.target.value })} /></Field>
        <Field label={r.fields.problem}><TextArea required minLength={20} maxLength={3000} rows={5} value={v.problem} placeholder={r.fields.problemPlaceholder} onChange={(e) => set({ problem: e.target.value })} /></Field>
        <div>
          <p className="mb-1.5 text-sm font-medium">{r.fields.categories}</p>
          <CheckList name="categories" columns={3} choices={categories} values={categoriesPicked} onChange={setCategories} max={5} />
        </div>
        {offered.length > 0 && categoriesPicked.length > 0 && (
          <div>
            <p className="mb-1.5 text-sm font-medium">{r.fields.useCases}</p>
            <CheckList name="useCases" columns={3} choices={offered} values={useCasesPicked} onChange={setUseCases} max={8} />
          </div>
        )}
      </Fieldset>

      <Fieldset legend={r.sectionTeam}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={r.fields.teamSize}>
            <SelectInput value={v.teamSize} onChange={(e) => set({ teamSize: e.target.value })}>
              <option value="">{r.anyOption}</option>
              {TEAM_SIZES.map((s) => <option key={s} value={s}>{r.teamSizes[s]}</option>)}
            </SelectInput>
          </Field>
          <Field label={r.fields.country}>
            <SelectInput value={v.countryCode} onChange={(e) => set({ countryCode: e.target.value })}>
              <option value="">{r.anyOption}</option>
              {countries.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </SelectInput>
          </Field>
          <Field label={r.fields.budget} hint={r.budgetHelp}>
            <div className="flex gap-2">
              <TextInput inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" maxLength={10} value={v.budget} onChange={(e) => set({ budget: e.target.value })} className="flex-1" />
              <SelectInput value={v.currency} aria-label={t.common.currencyField} onChange={(e) => set({ currency: e.target.value })} className="w-24">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</SelectInput>
            </div>
          </Field>
          <Field label={r.fields.budgetInterval}>
            <SelectInput value={v.interval} onChange={(e) => set({ interval: e.target.value })}>
              <option value="">{r.anyOption}</option>
              {INTERVALS.map((i) => <option key={i} value={i}>{r.intervals[i]}</option>)}
            </SelectInput>
          </Field>
          <label className="flex items-center gap-2.5 text-sm"><input type="checkbox" checked={v.perUser} onChange={(e) => set({ perUser: e.target.checked })} className="size-4 rounded border-border accent-[var(--brand)]" />{r.fields.budgetPerUser}</label>
          <Field label={r.fields.timeframe}>
            <SelectInput value={v.timeframe} onChange={(e) => set({ timeframe: e.target.value })}>
              <option value="">{r.anyOption}</option>
              {TIMEFRAMES.map((s) => <option key={s} value={s}>{r.timeframes[s]}</option>)}
            </SelectInput>
          </Field>
        </div>
      </Fieldset>

      <Fieldset legend={r.sectionRequirements} hint={r.factsHelp}>
        <div>
          <p className="mb-1.5 text-sm font-medium">{r.fields.requiredFacts}</p>
          <CheckList name="facts" columns={3} choices={facts} values={required} onChange={setRequired} max={12} />
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">{r.fields.languages}</p>
          <CheckList name="languages" columns={3} choices={languageList} values={languages} onChange={setLanguages} max={10} />
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">{r.fields.requiredPlatforms}</p>
          <CheckList name="platforms" columns={3} choices={PLATFORMS.map((p) => ({ value: p, label: t.filters.platforms[p] }))} values={platforms} onChange={setPlatforms} />
        </div>
        {integrations.length > 0 && (
          <div>
            <p className="mb-1.5 text-sm font-medium">{r.fields.requiredIntegrations}</p>
            <CheckList name="integrations" columns={3} choices={integrations} values={integrationsPicked} onChange={setIntegrations} max={10} />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={r.fields.mustHave} optional={t.common.optional}><TextArea rows={4} maxLength={2200} value={v.mustHave} placeholder={r.fields.mustHavePlaceholder} onChange={(e) => set({ mustHave: e.target.value })} /></Field>
          <Field label={r.fields.niceToHave} optional={t.common.optional}><TextArea rows={4} maxLength={2200} value={v.niceToHave} placeholder={r.fields.mustHavePlaceholder} onChange={(e) => set({ niceToHave: e.target.value })} /></Field>
        </div>
      </Fieldset>

      <Fieldset legend={r.sectionVisibility}>
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={r.fields.visibility}>
          {(["private", "public"] as const).map((k) => (
            <label key={k} className={cn("flex cursor-pointer gap-3 rounded-2xl border p-4 text-sm", v.visibility === k ? "border-brand bg-brand/5" : "border-border")}>
              <input type="radio" name="visibility" value={k} checked={v.visibility === k} onChange={() => set({ visibility: k })} className="mt-0.5 size-4 accent-[var(--brand)]" />
              <span><span className="block font-semibold">{r.visibility[k]}</span><span className="text-muted-foreground">{r.visibility[k === "private" ? "privateHelp" : "publicHelp"]}</span></span>
            </label>
          ))}
        </div>
      </Fieldset>

      <Fieldset legend={r.sectionContact} hint={r.contactHelp}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={r.fields.contactName} optional={t.common.optional}><TextInput maxLength={120} autoComplete="name" value={v.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label={r.fields.contactEmail} optional={t.common.optional}><TextInput type="email" maxLength={254} autoComplete="email" value={v.email} onChange={(e) => set({ email: e.target.value })} /></Field>
          <Field label={r.fields.companyName} optional={t.common.optional}><TextInput maxLength={160} autoComplete="organization" value={v.company} onChange={(e) => set({ company: e.target.value })} /></Field>
          <Field label={r.fields.phone} optional={t.common.optional}><TextInput type="tel" maxLength={40} autoComplete="tel" value={v.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
        </div>
        <div className="rounded-2xl bg-muted/60 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><Lock className="size-4 text-brand" aria-hidden />{r.privacyTitle}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{r.privacy.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      </Fieldset>

      {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="w-full rounded-full sm:w-auto" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />}{r.submit}</Button>
    </form>
  )
}
