"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { subscribeNewsletter } from "@/actions/account"
import { useI18n } from "@/i18n/client"

/** Records the address and the exact consent wording. No sender is connected yet, and the form says so. */
export function NewsletterForm({ source }: { source: string }) {
  const { t, locale } = useI18n()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  if (done) return <p role="status" className="text-sm"><span className="font-medium">{t.footer.newsletterDone}</span> <span className="text-muted-foreground">{t.footer.newsletterNote}</span></p>
  return (
    <form
      className="grid gap-2 sm:grid-cols-[1fr_auto]"
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        setError(null)
        start(async () => {
          const r = await subscribeNewsletter({ email: String(data.get("email") ?? ""), locale, source, consent: data.get("consent") === "on", consentText: t.footer.newsletterConsent })
          if (r.ok) setDone(true); else setError(r.error)
        })
      }}
    >
      <Input name="email" type="email" required maxLength={254} autoComplete="email" placeholder={t.footer.newsletterPlaceholder} aria-label={t.footer.newsletterEmail} className="h-10 rounded-full px-4" />
      <Button type="submit" disabled={pending} className="rounded-full">{t.footer.newsletterCta}</Button>
      <label className="flex items-start gap-2 text-xs text-muted-foreground sm:col-span-2">
        <input type="checkbox" name="consent" required className="mt-0.5 size-4 rounded border-border" />
        <span>{t.footer.newsletterConsent}</span>
      </label>
      {error && <p role="alert" className="text-xs text-destructive sm:col-span-2">{error}</p>}
    </form>
  )
}
