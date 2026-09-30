"use client"

import { useState } from "react"
import { CheckList, Field, Fieldset, SelectInput, TextArea, TextInput, type Choice } from "@/components/form/fields"
import { Button } from "@/components/ui/button"
import { useAction } from "./use-action"
import { updateListing } from "@/actions/maker"
import { useI18n } from "@/i18n/client"
import { LOCALES, LOCALE_NAMES, type Locale } from "@/i18n/config"
import { CURRENCIES, MAKER_PLATFORMS, PRICING_MODELS } from "@/lib/v2/options"

type Tri = "" | "yes" | "no"
const toTri = (v: boolean | null): Tri => (v === null ? "" : v ? "yes" : "no")
const fromTri = (v: Tri) => (v === "" ? null : v === "yes")

export interface ListingValues {
  appId: string; tagline: string; description: string; contentLocale: string; taglineDe: string; descriptionDe: string; category: string; useCases: string[]
  pricingModel: string; hasFreePlan: boolean | null; hasFreeTrial: boolean | null; startingPrice: number | null; priceCurrency: string
  languages: string[]; platforms: string[]; integrations: string[]; companyName: string; companyCountry: string; aliases: string[]
}

export function ListingForm({ initial, categories, useCases, integrations, countries, languages, locked }: {
  initial: ListingValues; categories: Choice[]; useCases: (Choice & { category: string | null })[]; integrations: Choice[]; countries: Choice[]; languages: Choice[]
  /** Values PWANova recorded itself. They are shown ticked and cannot be removed here. */
  locked: { languages: string[]; platforms: string[]; integrations: string[] }
}) {
  const { t } = useI18n("dashboard", "submit")
  const s = t.submit, d = t.dashboard
  const { pending, run } = useAction()
  const [v, setV] = useState({ ...initial, freePlan: toTri(initial.hasFreePlan), freeTrial: toTri(initial.hasFreeTrial), price: initial.startingPrice === null ? "" : String(initial.startingPrice), aliasText: initial.aliases.join(", ") })
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }))
  const offered = useCases.filter((u) => u.category === v.category)

  return (
    <form className="space-y-5" onSubmit={(e) => {
      e.preventDefault()
      const price = v.price.trim() === "" ? null : Number(v.price.replace(",", "."))
      run(() => updateListing({
        appId: v.appId, tagline: v.tagline, description: v.description, contentLocale: v.contentLocale as Locale, taglineDe: v.taglineDe, descriptionDe: v.descriptionDe,
        category: v.category, useCases: v.useCases.filter((u) => offered.some((o) => o.value === u)), pricingModel: v.pricingModel as (typeof PRICING_MODELS)[number],
        hasFreePlan: fromTri(v.freePlan), hasFreeTrial: fromTri(v.freeTrial), startingPrice: price !== null && Number.isFinite(price) ? price : null,
        priceCurrency: v.priceCurrency as (typeof CURRENCIES)[number], languages: v.languages.filter((l) => !locked.languages.includes(l)),
        platforms: v.platforms.filter((p) => !locked.platforms.includes(p)) as (typeof MAKER_PLATFORMS)[number][],
        integrations: v.integrations.filter((i) => !locked.integrations.includes(i)), companyName: v.companyName, companyCountry: v.companyCountry,
        aliases: v.aliasText.split(",").map((a) => a.trim()).filter((a) => a.length >= 2).slice(0, 8),
      }))
    }}>
      <Fieldset legend={s.stepDetails}>
        <Field label={s.tagline}><TextInput required minLength={3} maxLength={120} value={v.tagline} onChange={(e) => set({ tagline: e.target.value })} /></Field>
        <Field label={s.description}><TextArea rows={6} maxLength={4000} value={v.description} onChange={(e) => set({ description: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={s.contentLocale}>
            <SelectInput value={v.contentLocale} onChange={(e) => set({ contentLocale: e.target.value })}>{LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}</SelectInput>
          </Field>
          <Field label={s.category}>
            <SelectInput required value={v.category} onChange={(e) => set({ category: e.target.value, useCases: [] })}>
              <option value="" disabled>{s.choose}</option>
              {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </SelectInput>
          </Field>
        </div>
        {v.contentLocale !== "de" && (
          <div className="grid gap-4 rounded-2xl border border-dashed border-border p-4">
            <p className="text-xs text-muted-foreground">{s.germanHint}</p>
            <Field label={s.taglineDe} optional={t.common.optional}><TextInput maxLength={120} lang="de" value={v.taglineDe} onChange={(e) => set({ taglineDe: e.target.value })} /></Field>
            <Field label={s.descriptionDe} optional={t.common.optional}><TextArea rows={4} maxLength={4000} lang="de" value={v.descriptionDe} onChange={(e) => set({ descriptionDe: e.target.value })} /></Field>
          </div>
        )}
        {offered.length > 0 && (
          <div><p className="mb-1.5 text-sm font-medium">{s.useCases} <span className="text-xs font-normal text-muted-foreground">{s.useCasesHint}</span></p>
            <CheckList name="useCases" choices={offered} values={v.useCases} onChange={(useCases) => set({ useCases })} max={5} /></div>
        )}
        <Field label={d.aliases} hint={d.aliasesHint} optional={t.common.optional}><TextInput maxLength={500} value={v.aliasText} onChange={(e) => set({ aliasText: e.target.value })} /></Field>
      </Fieldset>

      <Fieldset legend={s.stepCompany}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={s.companyName} optional={t.common.optional}><TextInput maxLength={120} autoComplete="organization" value={v.companyName} onChange={(e) => set({ companyName: e.target.value })} /></Field>
          <Field label={s.companyCountry} optional={t.common.optional}>
            <SelectInput value={v.companyCountry} onChange={(e) => set({ companyCountry: e.target.value })}>
              <option value="">{s.notStated}</option>
              {countries.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </SelectInput>
          </Field>
          <Field label={s.pricingModel}>
            <SelectInput value={v.pricingModel} onChange={(e) => set({ pricingModel: e.target.value })}>
              {PRICING_MODELS.map((m) => <option key={m} value={m}>{m === "unknown" ? s.notStated : t.card.pricing[m]}</option>)}
            </SelectInput>
          </Field>
          <Field label={d.startingPrice} hint={d.startingPriceHint}>
            <div className="flex gap-2">
              <TextInput inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" maxLength={10} value={v.price} onChange={(e) => set({ price: e.target.value })} className="flex-1" />
              <SelectInput value={v.priceCurrency} aria-label={d.currency} onChange={(e) => set({ priceCurrency: e.target.value })} className="w-24">{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</SelectInput>
            </div>
          </Field>
          {([[s.hasFreePlan, "freePlan"], [s.hasFreeTrial, "freeTrial"]] as const).map(([label, key]) => (
            <Field key={key} label={label}>
              <SelectInput value={v[key]} onChange={(e) => set({ [key]: e.target.value as Tri })}>
                <option value="">{s.notStated}</option><option value="yes">{s.yes}</option><option value="no">{s.no}</option>
              </SelectInput>
            </Field>
          ))}
        </div>
        <div><p className="mb-1.5 text-sm font-medium">{s.languages}</p>
          <CheckList name="languages" columns={3} choices={languages} values={v.languages} onChange={(languages) => set({ languages: [...new Set([...languages, ...locked.languages])] })} max={20} /></div>
        <div><p className="mb-1.5 text-sm font-medium">{s.platforms}</p>
          <CheckList name="platforms" columns={3} choices={MAKER_PLATFORMS.map((p) => ({ value: p, label: t.filters.platforms[p] }))} values={v.platforms} onChange={(platforms) => set({ platforms: [...new Set([...platforms, ...locked.platforms.filter((p) => p !== "web" && p !== "pwa")])] })} /></div>
        <div><p className="mb-1.5 text-sm font-medium">{t.app.integrations}</p>
          <CheckList name="integrations" columns={3} choices={integrations} values={v.integrations} onChange={(list) => set({ integrations: [...new Set([...list, ...locked.integrations])] })} max={24} /></div>
      </Fieldset>
      <Button type="submit" size="lg" className="rounded-full" disabled={pending}>{d.saveListing}</Button>
    </form>
  )
}
