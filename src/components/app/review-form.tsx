"use client"

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Star } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { deleteReview, saveReview } from "@/actions/engagement"
import { cn } from "@/lib/utils"

interface Draft { rating: number; title: string; body: string }
const draftKey = (appId: string) => `pwn:draft:review:${appId}`

function readDraft(appId: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(appId))
    return raw ? (JSON.parse(raw) as Draft) : null
  } catch { return null } // private mode / storage disabled: drafts just don't persist, nothing else breaks
}
function writeDraft(appId: string, d: Draft) {
  try { localStorage.setItem(draftKey(appId), JSON.stringify(d)) } catch { /* best-effort only */ }
}
function clearDraft(appId: string) {
  try { localStorage.removeItem(draftKey(appId)) } catch { /* best-effort only */ }
}

const noSubscribe = () => () => {}
/**
 * Same idiom as usePlatform()/useIsPast(): reads a client-only value (localStorage) through
 * useSyncExternalStore instead of an effect + setState, which React's purity rules correctly flag as
 * a render-time side effect if done any other way. The server snapshot is always "no draft" (SSR has
 * no localStorage), so the very first paint matches the server, and React reconciles to the real
 * client value right after hydration -- no manual effect needed.
 *
 * getSnapshot must return a referentially stable value when nothing changed, or React re-renders
 * forever trying to "converge" (readDraft() does JSON.parse, which returns a new object every call).
 * Nothing here needs to react to the draft changing later in the same session, so a small per-instance
 * cache keyed by (appId, skip) is enough to make it stable.
 */
function useReviewDraft(appId: string, skip: boolean): Draft | null {
  const cache = useRef<{ key: string; value: Draft | null } | null>(null)
  return useSyncExternalStore(
    noSubscribe,
    () => {
      const key = `${appId}:${skip}`
      if (!cache.current || cache.current.key !== key) cache.current = { key, value: skip ? null : readDraft(appId) }
      return cache.current.value
    },
    () => null,
  )
}

interface Props {
  appId: string; slug: string; signedIn: boolean
  existing: { rating: number; title: string | null; body: string } | null; defaultRating: number | null
}

export function ReviewForm(props: Props) {
  const draft = useReviewDraft(props.appId, Boolean(props.existing))
  // Remounting when a draft is (or isn't) found lets the inner form seed its state fresh from it,
  // without ever calling setState from inside an effect.
  return <ReviewFormInner key={draft ? "restored" : "fresh"} {...props} draft={draft} />
}

function ReviewFormInner({ appId, slug, signedIn, existing, defaultRating, draft }: Props & { draft: Draft | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(Boolean(draft))
  // stars the user picked inside this form; otherwise fall back to their saved rating (which can change via the RateBox)
  const [picked, setPicked] = useState(existing?.rating ?? draft?.rating ?? 0)
  const rating = picked || defaultRating || 0
  const [title, setTitle] = useState(existing?.title ?? draft?.title ?? "")
  const [body, setBody] = useState(existing?.body ?? draft?.body ?? "")
  const [pending, start] = useTransition()

  // Autosave while writing, so a draft survives an accidental reload or a sign-in round trip.
  useEffect(() => {
    if (!open || existing) return
    if (!body && !title) return
    const t = setTimeout(() => writeDraft(appId, { rating, title, body }), 400)
    return () => clearTimeout(t)
  }, [open, existing, appId, rating, title, body])

  if (!open) {
    return <Button variant="outline" className="rounded-full" onClick={() => setOpen(true)}>{existing ? "Edit your review" : "Write a review"}</Button>
  }
  return (
    <form className="space-y-3 rounded-2xl border border-border bg-card p-4" onSubmit={(e) => {
      e.preventDefault()
      if (!signedIn) {
        writeDraft(appId, { rating, title, body }) // preserve it across the sign-in round trip
        router.push(`/sign-in?next=${encodeURIComponent(`/apps/${slug}#reviews`)}`)
        return
      }
      start(async () => {
        const r = await saveReview(appId, { rating, title, body })
        if (r.ok) { toast.success(r.message); clearDraft(appId); setOpen(false) } else toast.error(r.error)
      })
    }}>
      {!signedIn && <p className="rounded-xl bg-accent/60 p-2.5 text-xs text-accent-foreground">Write it now — you&apos;ll be asked to sign in only when you post, and what you wrote here is kept.</p>}
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} stars`} onClick={() => setPicked(n)}>
            <Star className={cn("size-7", n <= rating ? "fill-star text-star" : "text-muted-foreground/40")} strokeWidth={1.5} />
          </button>
        ))}
      </div>
      <Input placeholder="Title (optional)" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea placeholder="What do you like? What could be better?" required minLength={10} maxLength={3000} rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending || !rating}>{signedIn ? (existing ? "Save changes" : "Post review") : "Sign in to post"}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        {existing && <Button type="button" variant="destructive" className="ml-auto" disabled={pending} onClick={() => start(async () => {
          const r = await deleteReview(appId)
          if (r.ok) { toast.success(r.message); setOpen(false); setBody(""); setTitle("") } else toast.error(r.error)
        })}>Delete</Button>}
      </div>
    </form>
  )
}
