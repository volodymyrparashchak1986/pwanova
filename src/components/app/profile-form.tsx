"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Field, SelectInput, TextArea, TextInput } from "@/components/form/fields"
import { Button } from "@/components/ui/button"
import { saveProfile } from "@/actions/account"
import { useI18n } from "@/i18n/client"
import { LOCALES, LOCALE_NAMES } from "@/i18n/config"

export function ProfileForm({ initial }: { initial: { displayName: string; bio: string; website: string; locale: string } }) {
  const { t } = useI18n("profile")
  const [v, setV] = useState(initial)
  const [pending, start] = useTransition()
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveProfile(v); if (r.ok) toast.success(t.profile.saved); else toast.error(r.error) }) }}>
      <Field label={t.profile.displayName}><TextInput required maxLength={80} autoComplete="nickname" value={v.displayName} onChange={(e) => setV({ ...v, displayName: e.target.value })} /></Field>
      <Field label={t.profile.bio} optional={t.common.optional}><TextArea maxLength={500} rows={3} value={v.bio} onChange={(e) => setV({ ...v, bio: e.target.value })} /></Field>
      <Field label={t.profile.website} optional={t.common.optional}><TextInput type="url" placeholder="https://" maxLength={300} value={v.website} onChange={(e) => setV({ ...v, website: e.target.value })} /></Field>
      <Field label={t.profile.language} hint={t.profile.languageHint}>
        <SelectInput value={v.locale} onChange={(e) => setV({ ...v, locale: e.target.value })}>
          <option value="">–</option>
          {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
        </SelectInput>
      </Field>
      <Button type="submit" disabled={pending} className="rounded-full">{t.profile.save}</Button>
    </form>
  )
}
