"use client"

import { useState, useTransition } from "react"
import { Star } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { deleteReview, saveReview } from "@/actions/engagement"
import { cn } from "@/lib/utils"

export function ReviewForm({ appId, existing, defaultRating }: {
  appId: string; existing: { rating: number; title: string | null; body: string } | null; defaultRating: number | null
}) {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(existing?.rating ?? defaultRating ?? 0)
  const [title, setTitle] = useState(existing?.title ?? "")
  const [body, setBody] = useState(existing?.body ?? "")
  const [pending, start] = useTransition()

  if (!open) {
    return <Button variant="outline" className="rounded-full" onClick={() => setOpen(true)}>{existing ? "Edit your review" : "Write a review"}</Button>
  }
  return (
    <form className="space-y-3 rounded-2xl border border-border bg-card p-4" onSubmit={(e) => {
      e.preventDefault()
      start(async () => {
        const r = await saveReview(appId, { rating, title, body })
        if (r.ok) { toast.success(r.message); setOpen(false) } else toast.error(r.error)
      })
    }}>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} stars`} onClick={() => setRating(n)}>
            <Star className={cn("size-7", n <= rating ? "fill-star text-star" : "text-muted-foreground/40")} strokeWidth={1.5} />
          </button>
        ))}
      </div>
      <Input placeholder="Title (optional)" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea placeholder="What do you like? What could be better?" required minLength={10} maxLength={3000} rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending || !rating}>{existing ? "Save changes" : "Post review"}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        {existing && <Button type="button" variant="destructive" className="ml-auto" disabled={pending} onClick={() => start(async () => {
          const r = await deleteReview(appId)
          if (r.ok) { toast.success(r.message); setOpen(false); setBody(""); setTitle("") } else toast.error(r.error)
        })}>Delete</Button>}
      </div>
    </form>
  )
}
