"use client"

import { useState, useTransition } from "react"
import { Star } from "lucide-react"
import { toast } from "sonner"
import { Link } from "@/components/i18n/link"
import { deleteRating, rateApp } from "@/actions/engagement"
import { useI18n } from "@/i18n/client"
import { plural } from "@/i18n/format"
import { cn } from "@/lib/utils"

export function RateBox({ appId, slug, signedIn, isOwner, initial }: { appId: string; slug: string; signedIn: boolean; isOwner: boolean; initial: number | null }) {
  const { t, locale, href } = useI18n()
  const [value, setValue] = useState(initial ?? 0)
  const [hover, setHover] = useState(0)
  const [pending, start] = useTransition()

  if (isOwner) return <p className="text-sm text-muted-foreground">{t.reviews.ownApp}</p>
  if (!signedIn) return <p className="text-sm text-muted-foreground"><Link className="font-medium text-brand hover:underline" href={`/sign-in?next=${encodeURIComponent(href(`/apps/${slug}`))}`}>{t.common.signIn}</Link> · {t.reviews.signInToRate}</p>

  const pick = (n: number) => {
    const prev = value
    setValue(n)
    start(async () => {
      const r = await rateApp(appId, n)
      if (r.ok) toast.success(prev ? t.reviews.ratingUpdated : t.reviews.thanksRating)
      else { setValue(prev); toast.error(r.error) }
    })
  }
  const shown = hover || value
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{value ? t.reviews.yourRating : t.reviews.tapToRate}</p>
      <div className={cn("flex gap-1", pending && "opacity-60")} onMouseLeave={() => setHover(0)} role="radiogroup" aria-label={t.reviews.yourRating}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={plural(locale, n, t.reviews.nStars)} disabled={pending}
            onMouseEnter={() => setHover(n)} onClick={() => pick(n)} className="rounded-md p-0.5 transition-transform active:scale-90">
            <Star className={cn("size-8 transition-colors", n <= shown ? "fill-star text-star" : "text-muted-foreground/40")} strokeWidth={1.5} />
          </button>
        ))}
      </div>
      {value > 0 && <button type="button" className="mt-2 text-xs underline" disabled={pending} onClick={() => start(async () => {
        const result = await deleteRating(appId)
        if (result.ok) { setValue(0); toast.success(result.message) } else toast.error(result.error)
      })}>{t.reviews.removeRating}</button>}
    </div>
  )
}
