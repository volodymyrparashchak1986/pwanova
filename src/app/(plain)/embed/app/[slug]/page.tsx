import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { BadgeCheck, FlaskConical, Star } from "lucide-react"
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config"
import { plural } from "@/i18n/format"
import { dictionaries } from "@/i18n/dictionaries"
import { getAppBySlug } from "@/lib/data"
import { exampleApp, isExampleSlug } from "@/lib/partner-example"

export const metadata: Metadata = { title: "PWANova badge", robots: { index: false } }

/**
 * Embeddable badge card (part A of the Partner Kit; part B is the plain-image /api/badge/[slug]).
 * Frame-friendly (see next.config.ts). ?theme=dark|light forces a theme, ?lang=de|en the language.
 * Suspended, hidden and pending listings answer 404 here, same as the public API and the SVG badge.
 */
export default async function EmbedPage({ params, searchParams }: PageProps<"/embed/app/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const locale = isLocale(typeof sp.lang === "string" ? sp.lang : null) ? (sp.lang as "en" | "de") : DEFAULT_LOCALE
  // not getDictionary(): this route has no [locale] segment, and i18n/server reads that segment
  const t = dictionaries[locale]
  const ref = typeof sp.ref === "string" && /^[a-z0-9_-]{2,40}$/i.test(sp.ref) ? sp.ref : null
  // `_example` is the Partner Kit's static, clearly fictional sample (see src/lib/partner-example.ts)
  const app = isExampleSlug(slug) ? exampleApp : await getAppBySlug(slug)
  if (!app || app.status !== "published") notFound()
  const href = isExampleSlug(slug) ? `/${locale}/partners/demo` : `/${locale}/apps/${app.slug}?from=embed${ref ? `&ref=${encodeURIComponent(ref)}` : ""}`
  const rating = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(app.rating)
  return (
    <a href={href} target="_top" rel="noopener" lang={locale} className={`${sp.theme === "dark" ? "dark" : ""} flex h-screen w-full items-center gap-3 bg-card px-4 text-card-foreground no-underline`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white"><Star className="size-5 fill-current" aria-hidden /></span>
      <span className="min-w-0 leading-tight">
        <span className="block text-sm font-semibold">{app.ratingsCount ? `${rating} ★ · PWANova` : `${app.name} · PWANova`}</span>
        <span className="block truncate text-xs text-muted-foreground">{app.ratingsCount ? plural(locale, app.ratingsCount, t.card.ratings) : t.card.noRatings}</span>
        <span className="mt-0.5 flex items-center gap-2">
          {app.ownershipStatus === "verified_owner" && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand"><BadgeCheck className="size-3" aria-hidden />{t.card.owner.verified_owner}</span>}
          {app.isDemo && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground"><FlaskConical className="size-3" aria-hidden />{t.common.demo}</span>}
        </span>
      </span>
    </a>
  )
}
