"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Star } from "lucide-react"
import { toast } from "sonner"
import { rateApp } from "@/actions/engagement"
import { cn } from "@/lib/utils"

export function RateBox({ appId, slug, signedIn, isOwner, initial }: { appId: string; slug: string; signedIn: boolean; isOwner: boolean; initial: number | null }) {
  const [value, setValue] = useState(initial ?? 0)
  const [hover, setHover] = useState(0)
  const [pending, start] = useTransition()

  if (isOwner) return <p className="text-sm text-muted-foreground">You can&apos;t rate your own app.</p>
  if (!signedIn) return <p className="text-sm text-muted-foreground"><Link className="font-medium text-brand hover:underline" href={`/sign-in?next=/apps/${slug}`}>Sign in</Link> to rate this app.</p>

  const pick = (n: number) => {
    const prev = value
    setValue(n)
    start(async () => {
      const r = await rateApp(appId, n)
      if (r.ok) toast.success(prev ? "Rating updated" : "Thanks for rating!")
      else { setValue(prev); toast.error(r.error) }
    })
  }
  const shown = hover || value
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{value ? "Your rating" : "Tap to rate"}</p>
      <div className={cn("flex gap-1", pending && "opacity-60")} onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Your rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} disabled={pending}
            onMouseEnter={() => setHover(n)} onClick={() => pick(n)} className="rounded-md p-0.5 transition-transform active:scale-90">
            <Star className={cn("size-8 transition-colors", n <= shown ? "fill-star text-star" : "text-muted-foreground/40")} strokeWidth={1.5} />
          </button>
        ))}
      </div>
    </div>
  )
}
