import { BadgeCheck, CircleDashed, CircleHelp, CircleSlash2, MessageSquareQuote } from "lucide-react"
import type { Locale } from "@/i18n/config"
import type { Dictionary } from "@/i18n/dictionaries"
import { daysSince, fmt, formatDate } from "@/i18n/format"
import type { FactOrigin, FactState, VerificationState } from "@/lib/v2/types"
import { cn } from "@/lib/utils"

type TrustText = Dictionary["trust"]

/**
 * One fact as a pill. Three states, three looks:
 *   yes + verified   solid          yes + vendor stated   outlined, with a quote mark
 *   no               muted, struck  unknown               dashed, "Not verified"
 * A green check never appears for something nobody checked.
 */
export function TrustSignal({ label, state, origin, date, t, locale, size = "sm", answerOnly = false, className }: {
  label: string; state: FactState; origin: FactOrigin; date?: string | null; t: TrustText; locale: Locale; size?: "sm" | "md"
  /** In a table row the fact's name is already next to the pill, so the pill carries the answer alone. */
  answerOnly?: boolean; className?: string
}) {
  const verified = state !== "unknown" && origin === "verified"
  const vendor = state !== "unknown" && origin === "vendor"
  const Icon = state === "unknown" ? CircleDashed : state === "no" ? CircleSlash2 : verified ? BadgeCheck : MessageSquareQuote
  const how = state === "unknown" ? t.notVerifiedLong : verified ? t.sourceObservedLong : t.sourceVendorLong
  const when = date ? fmt(verified ? t.lastChecked : t.statedOn, { date: formatDate(locale, date) }) : ""
  const title = [label, how, when].filter(Boolean).join(" · ")
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        state === "unknown" && "border border-dashed border-border text-muted-foreground",
        state === "no" && "bg-muted text-muted-foreground",
        state === "yes" && verified && "bg-ok/12 text-ok",
        state === "yes" && vendor && "border border-border text-foreground/80",
        className,
      )}
    >
      <Icon className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden />
      <span>{state !== "unknown" ? label : answerOnly ? t.notVerified : `${label}: ${t.notVerified}`}</span>
      {vendor && <span className="sr-only"> ({t.sourceVendor})</span>}
      {verified && <span className="sr-only"> ({t.sourceObserved})</span>}
    </span>
  )
}

const STATE_STYLE: Record<VerificationState, string> = {
  unverified: "border border-dashed border-border text-muted-foreground",
  pending: "bg-muted text-muted-foreground",
  partially_verified: "bg-brand/10 text-brand",
  evidence_verified: "bg-ok/12 text-ok",
  stale: "bg-warn/15 text-warn",
  verification_failed: "bg-muted text-muted-foreground",
}

export function VerificationStatus({ state, checkedAt, t, locale, className }: { state: VerificationState; checkedAt?: string | null; t: TrustText; locale: Locale; className?: string }) {
  const days = daysSince(checkedAt ?? null)
  const when = checkedAt ? fmt(t.lastChecked, { date: formatDate(locale, checkedAt) }) : ""
  return (
    <span title={[t.stateHelp[state], when, t.notACertificate].filter(Boolean).join(" · ")}
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", STATE_STYLE[state], className)}>
      {state === "evidence_verified" || state === "partially_verified" ? <BadgeCheck className="size-3.5" aria-hidden /> : <CircleHelp className="size-3.5" aria-hidden />}
      {t.states[state]}
      {days !== null && days > 180 && state !== "stale" && <span className="sr-only"> · {t.stale}</span>}
    </span>
  )
}

/** "Sponsored" / "Anzeige": always visible text, never only a colour. */
export function SponsoredLabel({ label, help, className }: { label: string; help: string; className?: string }) {
  return <span title={help} className={cn("inline-flex items-center rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase", className)}>{label}</span>
}
