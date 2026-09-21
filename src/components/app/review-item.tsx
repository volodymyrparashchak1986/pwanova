"use client"

import { useState, useTransition } from "react"
import { BadgeCheck, CornerDownRight, Flag, ThumbsUp } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Stars } from "./stars"
import { ReportDialog } from "./report-dialog"
import { respondToReview, toggleHelpful } from "@/actions/engagement"
import { timeAgo } from "@/lib/format"
import type { ReviewView } from "@/lib/types"
import { cn } from "@/lib/utils"

export function ReviewItem({ review, slug, viewerId, canRespond }: { review: ReviewView; slug: string; viewerId: string | null; canRespond: boolean }) {
  const [helpful, setHelpful] = useState(Boolean(review.helpfulByMe))
  const [count, setCount] = useState(review.helpfulCount)
  const [reportOpen, setReportOpen] = useState(false)
  const [replying, setReplying] = useState(false)
  const [reply, setReply] = useState(review.response?.body ?? "")
  const [pending, start] = useTransition()
  const mine = viewerId === review.userId

  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <header className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-sm font-semibold">
          {review.author.avatarUrl
            // eslint-disable-next-line @next/next/no-img-element -- remote avatar
            ? <img src={review.author.avatarUrl} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
            : review.author.name.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{review.author.name}{mine && <span className="ml-2 text-xs font-normal text-muted-foreground">You</span>}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Stars value={review.rating} size={12} /><span>{timeAgo(review.createdAt)}</span>
            {review.verifiedUsage && <span className="inline-flex items-center gap-0.5 text-brand"><BadgeCheck className="size-3" />Verified usage</span>}
            {review.isDemo && <span className="rounded-full border border-dashed border-border px-1.5">demo</span>}
          </div>
        </div>
      </header>
      {review.title && <h4 className="mt-3 font-semibold">{review.title}</h4>}
      <p className={cn("whitespace-pre-line text-[15px] text-foreground/90", review.title ? "mt-1" : "mt-3")}>{review.body}</p>

      {review.response && !replying && (
        <div className="mt-4 rounded-xl bg-muted/70 p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold"><CornerDownRight className="size-3.5" />Developer Response <span className="font-normal text-muted-foreground">· {review.response.developerName}</span></p>
          <p className="mt-1 whitespace-pre-line text-sm">{review.response.body}</p>
        </div>
      )}
      {replying && (
        <div className="mt-4 space-y-2">
          <Textarea value={reply} onChange={(e) => setReply(e.target.value)} maxLength={2000} rows={3} placeholder="Write a public response" />
          <div className="flex gap-2">
            <Button size="sm" disabled={pending} onClick={() => start(async () => {
              const r = await respondToReview(review.id, reply, slug)
              if (r.ok) { toast.success(r.message); setReplying(false) } else toast.error(r.error)
            })}>Post response</Button>
            <Button size="sm" variant="ghost" onClick={() => setReplying(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <footer className="mt-4 flex items-center gap-2">
        <Button size="sm" variant={helpful ? "secondary" : "outline"} className="rounded-full" disabled={pending || mine} aria-pressed={helpful}
          title={mine ? "You can't vote on your own review" : undefined}
          onClick={() => {
            if (!viewerId) return toast.info("Sign in to vote on reviews.")
            const next = !helpful
            setHelpful(next); setCount((c) => c + (next ? 1 : -1))
            start(async () => {
              const r = await toggleHelpful(review.id, slug)
              if (!r.ok) { setHelpful(!next); setCount((c) => c + (next ? -1 : 1)); toast.error(r.error) }
            })
          }}>
          <ThumbsUp className={cn("size-3.5", helpful && "fill-current")} />Helpful{count > 0 && ` · ${count}`}
        </Button>
        {canRespond && !replying && <Button size="sm" variant="ghost" onClick={() => setReplying(true)}>{review.response ? "Edit response" : "Respond"}</Button>}
        {!mine && <Button size="sm" variant="ghost" className="ml-auto text-muted-foreground" onClick={() => (viewerId ? setReportOpen(true) : toast.info("Sign in to report reviews."))}><Flag className="size-3.5" />Report</Button>}
      </footer>
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} target={{ reviewId: review.id }} title="Report review" />
    </article>
  )
}
