"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Field, TextArea, TextInput } from "@/components/form/fields"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { declineResponse, rematchRequest, respondToRequest, revokeContact, saveRequestContact, setRequestStatus, shareContact, withdrawResponse } from "@/actions/requests"
import { useI18n } from "@/i18n/client"
import { fmt } from "@/i18n/format"
import type { RequestContact } from "@/lib/data/requests"

type ContactField = "contact_name" | "contact_email" | "company_name" | "phone" | "note"
const FIELDS: ContactField[] = ["contact_name", "contact_email", "company_name", "phone", "note"]

function useRun() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) => start(async () => {
    const r = await fn()
    if (r.ok) { if (r.message) toast.success(r.message); after?.(); router.refresh() } else toast.error(r.error ?? "")
  })
  return { pending, run }
}

export function OwnerActions({ publicId, status }: { publicId: string; status: string }) {
  const { t } = useI18n("requests")
  const { pending, run } = useRun()
  const open = status === "open" || status === "matched"
  return (
    <div className="flex flex-wrap gap-2">
      {open && <Button variant="outline" className="rounded-full" disabled={pending} onClick={() => run(() => rematchRequest(publicId))}>{pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{t.requests.rematch}</Button>}
      {status !== "hidden" && <Button variant="ghost" className="rounded-full" disabled={pending} onClick={() => run(() => setRequestStatus(publicId, open ? "closed" : "open"))}>{open ? t.requests.close : t.requests.reopen}</Button>}
    </div>
  )
}

export function ContactForm({ publicId, contact }: { publicId: string; contact: RequestContact | null }) {
  const { t } = useI18n("requests")
  const f = t.requests.fields
  const { pending, run } = useRun()
  const [v, setV] = useState({ name: contact?.contact_name ?? "", email: contact?.contact_email ?? "", company: contact?.company_name ?? "", phone: contact?.phone ?? "", note: contact?.note ?? "" })
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => saveRequestContact({ publicId, ...v })) }}>
      <Field label={f.contactName}><TextInput maxLength={120} autoComplete="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
      <Field label={f.contactEmail}><TextInput type="email" maxLength={254} autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
      <Field label={f.companyName}><TextInput maxLength={160} autoComplete="organization" value={v.company} onChange={(e) => setV({ ...v, company: e.target.value })} /></Field>
      <Field label={f.phone}><TextInput type="tel" maxLength={40} autoComplete="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
      <Field label={t.requests.fieldNames.note} className="sm:col-span-2"><TextArea rows={2} maxLength={500} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></Field>
      <div className="sm:col-span-2"><Button type="submit" variant="outline" className="rounded-full" disabled={pending}>{t.common.saveChanges}</Button></div>
    </form>
  )
}

/** The buyer decides, per vendor, which details to share. The consent wording they see is the wording that is stored. */
export function ShareContact({ publicId, responseId, vendorName, contact, shared }: { publicId: string; responseId: string; vendorName: string; contact: RequestContact | null; shared: boolean }) {
  const { t } = useI18n("requests")
  const { pending, run } = useRun()
  const [open, setOpen] = useState(false)
  const available = FIELDS.filter((k) => contact?.[k])
  const [fields, setFields] = useState<ContactField[]>(available.filter((k) => k !== "phone" && k !== "note"))
  const [agreed, setAgreed] = useState(false)
  const consent = fmt(t.requests.shareConsent, { name: vendorName })
  if (shared) {
    return <Button size="sm" variant="outline" className="rounded-full" disabled={pending} onClick={() => run(() => revokeContact(responseId, publicId))}>{t.requests.revoke}</Button>
  }
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="rounded-full" onClick={() => setOpen(true)}>{t.requests.shareContact}</Button>
        <Button size="sm" variant="ghost" className="rounded-full" disabled={pending} onClick={() => run(() => declineResponse(responseId, publicId))}>{t.requests.decline}</Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{fmt(t.requests.shareTitle, { name: vendorName })}</DialogTitle><DialogDescription>{t.requests.privacy[2]}</DialogDescription></DialogHeader>
          {available.length === 0 ? <p className="text-sm text-muted-foreground">{t.requests.contactNone}</p> : (
            <>
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">{t.requests.shareFields}</legend>
                <ul className="space-y-1">
                  {available.map((k) => (
                    <li key={k}>
                      <label className="flex items-start gap-2.5 rounded-lg px-1.5 py-1.5 text-sm hover:bg-muted/70">
                        <input type="checkbox" checked={fields.includes(k)} onChange={() => setFields(fields.includes(k) ? fields.filter((x) => x !== k) : [...fields, k])} className="mt-0.5 size-4 rounded border-border accent-[var(--brand)]" />
                        <span><span className="font-medium">{t.requests.fieldNames[k]}</span><span className="block text-muted-foreground">{contact?.[k]}</span></span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
              <label className="flex items-start gap-2.5 text-sm">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-4 rounded border-border accent-[var(--brand)]" />
                <span>{consent}</span>
              </label>
              <Button disabled={pending || !agreed || !fields.length} onClick={() => run(() => shareContact({ responseId, fields, consentText: consent, publicId }), () => setOpen(false))}>{t.requests.shareContact}</Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** A vendor says they are interested. They write to the requirements, not to a person. */
export function VendorRespond({ requestId, appId, response }: { requestId: string; appId: string; response: { id: string; status: string; message: string | null } | null }) {
  const { t } = useI18n("requests")
  const v = t.requests.vendor
  const { pending, run } = useRun()
  const [message, setMessage] = useState("")
  if (response && response.status !== "withdrawn") {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{(t.requests.responseStatus as Record<string, string>)[response.status] ?? response.status}</span>
        {response.status === "interested" && <><span className="text-muted-foreground">{v.waiting}</span><Button size="sm" variant="ghost" className="rounded-full" disabled={pending} onClick={() => run(() => withdrawResponse(response.id))}>{v.withdraw}</Button></>}
      </div>
    )
  }
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => respondToRequest({ requestId, appId, message }), () => setMessage("")) }}>
      <Field label={v.message} hint={v.messageHelp}><TextArea rows={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
      <Button type="submit" size="sm" className="rounded-full" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />}{v.respond}</Button>
    </form>
  )
}
