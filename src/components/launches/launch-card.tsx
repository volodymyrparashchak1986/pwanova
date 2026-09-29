import { Bookmark, Eye, MessageSquare, Users } from "lucide-react"
import { AppIcon } from "@/components/app/app-icon"
import { Link } from "@/components/i18n/link"
import { SponsoredLabel, VerificationStatus } from "@/components/trust/trust-signal"
import { daysSince, fmt, formatDate, formatNumber, plural } from "@/i18n/format"
import { getI18n } from "@/i18n/server"
import type { LaunchItem } from "@/lib/v2/types"

/** Days left in the 30-day discovery window, never negative. */
export function daysLeft(windowEnd: string | null, now: number = Date.now()): number | null {
  if (!windowEnd) return null
  const ms = new Date(windowEnd).getTime() - now
  return Number.isNaN(ms) ? null : Math.max(0, Math.ceil(ms / 86_400_000))
}

export async function LaunchCard({ launch }: { launch: LaunchItem }) {
  const { t, locale } = await getI18n()
  const headline = (locale === "de" && launch.headlineDe) || launch.headline
  const left = launch.inWindow ? daysLeft(launch.windowEnd) : null
  const signals = [
    [Bookmark, t.launches.signals.saves, launch.signals.saves], [Users, t.launches.signals.follows, launch.signals.follows],
    [MessageSquare, t.launches.signals.reviews, launch.signals.reviews], [Eye, t.launches.signals.visitors, launch.signals.visitors],
  ] as const
  return (
    <article className="group relative flex gap-4 rounded-3xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand/30">
      <AppIcon app={launch.app} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {launch.isSponsored && <SponsoredLabel label={t.card.sponsored} help={t.card.sponsoredHelp} />}
          <p className="text-xs text-muted-foreground">
            {launch.app.name}{launch.maker.name ? ` · ${fmt(t.launches.by, { name: launch.maker.name })}` : ""}
          </p>
        </div>
        <h3 className="mt-1 text-base leading-snug font-semibold text-balance">
          <Link href={`/launches/${launch.slug}`} className="after:absolute after:inset-0 after:rounded-3xl after:content-['']">{headline}</Link>
        </h3>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {left !== null ? plural(locale, left, t.launches.daysLeft) : fmt(t.launches.windowEnded, { date: formatDate(locale, launch.windowStart ?? launch.launchDate) })}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <VerificationStatus state={launch.app.verificationState} t={t.trust} locale={locale} className="px-2 py-0.5 text-[11px]" />
          <ul className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            {signals.filter(([, , n]) => n > 0).map(([Icon, label, n]) => (
              <li key={label} className="inline-flex items-center gap-1" title={label}><Icon className="size-3.5" aria-hidden /><span className="sr-only">{label}: </span>{formatNumber(locale, n)}</li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  )
}

export const launchIsFresh = (launch: LaunchItem) => (daysSince(launch.windowStart ?? launch.launchDate) ?? 99) <= 7
