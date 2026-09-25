"use client"

import { useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { ReviewCard, type ReviewCardApp } from "./review-card"
import type { ReviewView } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface CarouselItem { app: ReviewCardApp; review: ReviewView }

/** Scroll-snap carousel: native horizontal scrolling and swiping, arrow buttons on wider screens. */
export function ReviewCarousel({ items, label = "Community reviews" }: { items: CarouselItem[]; label?: string }) {
  const track = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: true, end: items.length <= 1 })

  const update = () => {
    const el = track.current
    if (!el) return
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 })
  }
  const step = (dir: 1 | -1) => {
    const el = track.current
    if (!el) return
    const card = el.querySelector<HTMLElement>("[data-card]")
    el.scrollBy({ left: dir * ((card?.offsetWidth ?? el.clientWidth) + 16), behavior: "smooth" })
  }

  return (
    <div className="relative">
      <div ref={track} onScroll={update} role="region" aria-roledescription="carousel" aria-label={label} tabIndex={0}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 outline-none focus-visible:ring-2 focus-visible:ring-brand/40 md:mx-0 md:px-0">
        {items.map(({ app, review }, i) => (
          <div key={review.id} data-card className="w-[min(85vw,22rem)] shrink-0 snap-start" aria-label={`Review ${i + 1} of ${items.length}`}>
            <ReviewCard review={review} app={app} />
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div className="pointer-events-none absolute inset-y-0 -left-3 -right-3 hidden items-center justify-between md:flex">
          {([-1, 1] as const).map((dir) => {
            const disabled = dir === -1 ? edges.start : edges.end
            const Icon = dir === -1 ? ChevronLeft : ChevronRight
            return (
              <button key={dir} type="button" onClick={() => step(dir)} disabled={disabled} aria-label={dir === -1 ? "Previous reviews" : "Next reviews"}
                className={cn("pointer-events-auto grid size-10 place-items-center rounded-full border border-border bg-card/95 shadow-soft transition-opacity hover:bg-muted", disabled && "opacity-0")}>
                <Icon className="size-5" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
