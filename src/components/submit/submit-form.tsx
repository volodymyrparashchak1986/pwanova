"use client"

import { useState, useTransition } from "react"
import { Check, CircleDashed, Loader2, Search, TriangleAlert } from "lucide-react"
import { AppIcon } from "@/components/app/app-icon"
import { CheckList, Field, Fieldset, SelectInput, TextArea, TextInput, type Choice } from "@/components/form/fields"
import { Link } from "@/components/i18n/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { analyzeApp, submitApp, type AnalysisSummary, type DuplicateHint, type SubmitInput } from "@/actions/apps"
import { useI18n } from "@/i18n/client"
import { LOCALES, LOCALE_NAMES, type Locale } from "@/i18n/config"
import { DOCUMENT_FIELDS, LANGUAGES, MAKER_PLATFORMS, PRICING_MODELS, type DocumentField } from "@/lib/v2/options"
import { cn } from "@/lib/utils"

type Tri = "" | "yes" | "no"
const tri = (v: Tri) => (v === "" ? null : v === "yes")
const DOC_FIELDS: DocumentField[] = ["privacyUrl", "legalUrl", "dpaUrl", "subprocessorsUrl", "pricingUrl", "apiDocsUrl", "mcpDocsUrl", "githubUrl"]

/** One line of "what PWANova found". Not found is shown as not found, never as a fault. */
function Found({ ok, label, value, notFound }: { ok: boolean | null; label: string; value?: string; notFound: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
      <span><span className="font-medium">{label}</span>{value ? <span className="text-muted-foreground">: {value}</span> : !ok ? <span className="text-muted-foreground">: {notFound}</span> : null}</span>
    </li>
  )
}

export function SubmitForm({ categories, useCases, capabilities, countries, languages: languageList, factLabels, initialUrl, partnerRef }: {
  categories: Choice[]; useCases: (Choice & { category: string | null })[]; capabilities: Choice[]; countries: Choice[]; languages: Choice[]
  factLabels: Record<string, string>; initialUrl?: string; partnerRef?: string
}) {
  const { t, locale } = useI18n("submit")
  const s = t.submit
  const [url, setUrl] = useState(initialUrl ?? "")
  const [analysis, setAnalysis] = useState<AnalysisSummary | null>(null)
  const [duplicates, setDuplicates] = useState<DuplicateHint[]>([])
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ slug: string } | null>(null)
  const [pending, start] = useTransition()

  const [name, setName] = useState("")
  const [tagline, setTagline] = useState("")
  const [description, setDescription] = useState("")
  const [contentLocale, setContentLocale] = useState<Locale>(locale)
  const [taglineDe, setTaglineDe] = useState("")
  const [descriptionDe, setDescriptionDe] = useState("")
  const [category, setCategory] = useState("")
  const [picked, setPicked] = useState<string[]>([])
  const [companyName, setCompanyName] = useState("")
  const [companyCountry, setCompanyCountry] = useState("")
  const [pricingModel, setPricingModel] = useState<(typeof PRICING_MODELS)[number]>("unknown")
  const [freePlan, setFreePlan] = useState<Tri>("")
  const [freeTrial, setFreeTrial] = useState<Tri>("")
  const [languages, setLanguages] = useState<string[]>([])
  const [platforms, setPlatforms] = useState<string[]>([])
  const [stated, setStated] = useState<string[]>([])
  const [docs, setDocs] = useState<Record<DocumentField, string>>({ privacyUrl: "", legalUrl: "", dpaUrl: "", subprocessorsUrl: "", pricingUrl: "", githubUrl: "", apiDocsUrl: "", mcpDocsUrl: "" })

  const exact = duplicates.find((d) => d.exact)
  const similar = duplicates.filter((d) => !d.exact)

  const analyse = () => start(async () => {
    setError(null)
    const r = await analyzeApp(url)
    if (!r.ok) { setError(r.error); return }
    const a = r.analysis
    setAnalysis(a); setDuplicates(r.duplicates); setWaiting(r.alreadySubmitted)
    setName((v) => v || a.title.split(/\s[|–—·-]\s/)[0].slice(0, 80))
    setTagline((v) => v || a.description.split(/(?<=[.!?])\s/)[0].slice(0, 120))
    setDescription((v) => v || a.description)
    setLanguages((v) => (v.length ? v : a.languages.filter((l) => (LANGUAGES as readonly string[]).includes(l))))
    if (a.languages[0] && (LOCALES as readonly string[]).includes(a.languages[0])) setContentLocale(a.languages[0] as Locale)
    setDocs((v) => {
      const next = { ...v }
      for (const d of a.discovered) {
        const field = DOCUMENT_FIELDS[d.kind as keyof typeof DOCUMENT_FIELDS]
        if (field && !next[field]) next[field] = d.url
      }
      return next
    })
  })

  const submit = () => start(async () => {
    setError(null)
    const input: SubmitInput = {
      url, name, tagline, description, contentLocale, taglineDe, descriptionDe, category, useCases: picked, companyName, companyCountry,
      pricingModel, hasFreePlan: tri(freePlan), hasFreeTrial: tri(freeTrial), languages, platforms: platforms as SubmitInput["platforms"],
      capabilities: stated as SubmitInput["capabilities"], ...docs, iconUrl: analysis?.iconUrl ?? undefined, screenshots: analysis?.screenshots, ref: partnerRef,
    }
    const r = await submitApp(input)
    if (r.ok && r.data) setDone({ slug: r.data.slug })
    else if (!r.ok) setError(r.error)
  })

  if (done) {
    return (
      <div role="status" className="rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-ok/12 text-ok"><Check className="size-6" /></div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">{s.doneTitle}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{s.pending}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href={`/apps/${done.slug}/claim`} className={cn(buttonVariants({ size: "lg" }), "rounded-full")}>{s.doneClaim}</Link>
          <Link href="/dashboard" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "rounded-full")}>{s.doneDashboard}</Link>
        </div>
      </div>
    )
  }

  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (analysis && !exact && !waiting) submit(); else analyse() }}>
      <Fieldset legend={s.stepUrl}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextInput type="url" inputMode="url" required maxLength={2048} placeholder="https://" value={url} aria-label={s.url} readOnly={Boolean(analysis)}
            onChange={(e) => setUrl(e.target.value)} className="flex-1" />
          {analysis
            ? <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => { setAnalysis(null); setDuplicates([]); setWaiting(false) }}>{s.changeUrl}</Button>
            : <Button type="button" className="h-11 rounded-xl" disabled={pending || url.length < 4} onClick={analyse}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}{pending ? s.analyzing : s.analyze}</Button>}
        </div>

        {analysis && (
          <div className="rounded-2xl bg-muted/60 p-4">
            <div className="flex items-center gap-3">
              <AppIcon app={{ name: name || analysis.domain, slug: analysis.domain, iconUrl: analysis.iconUrl }} size="sm" />
              <p className="text-sm font-semibold">{s.found}<span className="block text-xs font-normal text-muted-foreground">{analysis.domain}</span></p>
            </div>
            {!analysis.reachable && <p className="mt-3 flex items-start gap-2 text-sm text-warn"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{s.analysisFailed}</p>}
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              <Found notFound={s.notFound} ok={Boolean(analysis.title)} label={s.foundLabels.title} value={analysis.title} />
              <Found notFound={s.notFound} ok={analysis.httpsOk} label={s.foundLabels.https} />
              <Found notFound={s.notFound} ok={analysis.isPwa} label={s.foundLabels.manifest} />
              <Found notFound={s.notFound} ok={analysis.languages.length > 0} label={s.foundLabels.languages} value={analysis.languages.map((l) => languageList.find((x) => x.value === l)?.label ?? l).join(", ")} />
              <Found notFound={s.notFound} ok={analysis.discovered.length > 0} label={s.foundLabels.documents} value={analysis.discovered.map((d) => factLabels[d.kind] ?? d.kind).join(", ")} />
            </ul>
          </div>
        )}

        {exact && (
          <div role="alert" className="rounded-2xl border border-border bg-accent/50 p-4">
            <p className="font-semibold">{s.duplicateTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.duplicateBody}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/apps/${exact.slug}/claim`} className={cn(buttonVariants(), "rounded-full")}>{s.duplicateCta}</Link>
              <Link href={`/apps/${exact.slug}`} className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}>{s.viewListing}</Link>
            </div>
          </div>
        )}
        {waiting && !exact && <p role="alert" className="rounded-2xl border border-border bg-accent/50 p-4 text-sm">{s.alreadySubmitted}</p>}
        {similar.length > 0 && !exact && (
          <div className="rounded-2xl border border-dashed border-border p-4">
            <p className="text-sm font-semibold">{s.similarTitle}</p>
            <p className="text-sm text-muted-foreground">{s.similarBody}</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {similar.map((d) => <li key={d.slug}><Link href={`/apps/${d.slug}`} target="_blank" className="rounded-full border border-border px-3 py-1 text-sm hover:border-brand/40">{d.name} <span className="text-muted-foreground">· {d.domain}</span></Link></li>)}
            </ul>
          </div>
        )}
      </Fieldset>

      {analysis && !exact && !waiting && (
        <>
          <Fieldset legend={s.stepDetails}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={s.name}><TextInput required maxLength={80} value={name} placeholder={s.namePlaceholder} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label={s.category}>
                <SelectInput required value={category} onChange={(e) => { setCategory(e.target.value); setPicked([]) }}>
                  <option value="" disabled>{s.choose}</option>
                  {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </SelectInput>
              </Field>
            </div>
            <Field label={s.tagline}><TextInput required minLength={3} maxLength={120} value={tagline} placeholder={s.taglinePlaceholder} onChange={(e) => setTagline(e.target.value)} /></Field>
            <Field label={s.description}><TextArea rows={5} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            <Field label={s.contentLocale}>
              <SelectInput value={contentLocale} onChange={(e) => setContentLocale(e.target.value as Locale)}>
                {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
              </SelectInput>
            </Field>
            {contentLocale !== "de" && (
              <div className="grid gap-4 rounded-2xl border border-dashed border-border p-4">
                <p className="text-xs text-muted-foreground">{s.germanHint}</p>
                <Field label={s.taglineDe} optional={t.common.optional}><TextInput maxLength={120} lang="de" value={taglineDe} onChange={(e) => setTaglineDe(e.target.value)} /></Field>
                <Field label={s.descriptionDe} optional={t.common.optional}><TextArea rows={4} maxLength={4000} lang="de" value={descriptionDe} onChange={(e) => setDescriptionDe(e.target.value)} /></Field>
              </div>
            )}
            {category && useCases.some((u) => u.category === category) && (
              <div>
                <p className="mb-1.5 text-sm font-medium">{s.useCases} <span className="text-xs font-normal text-muted-foreground">{s.useCasesHint}</span></p>
                <CheckList name="useCases" choices={useCases.filter((u) => u.category === category)} values={picked} onChange={setPicked} max={5} />
              </div>
            )}
          </Fieldset>

          <Fieldset legend={s.stepCompany}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={s.companyName} optional={t.common.optional}><TextInput maxLength={120} autoComplete="organization" value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></Field>
              <Field label={s.companyCountry} optional={t.common.optional}>
                <SelectInput value={companyCountry} onChange={(e) => setCompanyCountry(e.target.value)}>
                  <option value="">{s.notStated}</option>
                  {countries.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </SelectInput>
              </Field>
              <Field label={s.pricingModel}>
                <SelectInput value={pricingModel} onChange={(e) => setPricingModel(e.target.value as typeof pricingModel)}>
                  {PRICING_MODELS.map((m) => <option key={m} value={m}>{m === "unknown" ? s.notStated : t.card.pricing[m]}</option>)}
                </SelectInput>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                {([[s.hasFreePlan, freePlan, setFreePlan], [s.hasFreeTrial, freeTrial, setFreeTrial]] as const).map(([label, value, set]) => (
                  <Field key={label} label={label}>
                    <SelectInput value={value} onChange={(e) => set(e.target.value as Tri)}>
                      <option value="">{s.notStated}</option><option value="yes">{s.yes}</option><option value="no">{s.no}</option>
                    </SelectInput>
                  </Field>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium">{s.languages}</p>
              <CheckList name="languages" columns={3} choices={languageList} values={languages} onChange={setLanguages} max={20} />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium">{s.platforms}</p>
              <CheckList name="platforms" columns={3} choices={MAKER_PLATFORMS.map((p) => ({ value: p, label: t.filters.platforms[p] }))} values={platforms} onChange={setPlatforms} />
            </div>
          </Fieldset>

          <Fieldset legend={s.stepDocs} hint={s.evidenceBody}>
            <p className="text-xs text-muted-foreground">{s.docsHint}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {DOC_FIELDS.map((f) => (
                <Field key={f} label={s[f]} optional={t.common.optional}>
                  <TextInput type="url" inputMode="url" maxLength={500} placeholder="https://" value={docs[f]} onChange={(e) => setDocs({ ...docs, [f]: e.target.value })} />
                </Field>
              ))}
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">{s.capabilities}</p>
              <p className="mb-2 text-xs text-muted-foreground">{s.capabilitiesHint}</p>
              <CheckList name="capabilities" columns={3} choices={capabilities} values={stated} onChange={setStated} />
            </div>
          </Fieldset>

          <p className="text-xs text-muted-foreground">{s.statedNote}</p>
          {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" className="w-full rounded-full sm:w-auto" disabled={pending || !name || !tagline || !category}>
            {pending && <Loader2 className="size-4 animate-spin" />}{pending ? s.submitting : s.submit}
          </Button>
        </>
      )}
      {error && !(analysis && !exact && !waiting) && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    </form>
  )
}
