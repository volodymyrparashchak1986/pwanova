import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { BadgeCheck, FlaskConical, Star } from "lucide-react"
import { getAppBySlug } from "@/lib/data"
import { plural } from "@/lib/format"

export const metadata: Metadata = { title: "PWANova badge", robots: { index: false } }

/**
 * Embeddable badge card (part A of the Partner Kit; part B is the plain-image /api/badge/[slug]).
 * Frame-friendly (see next.config.ts). Use ?theme=dark|light to force a theme.
 * Suspended/hidden/pending listings 404 here too, same as the public API and the SVG badge.
 */
export default async function EmbedPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ theme?: string }> }) {
  const [{ slug }, { theme }] = await Promise.all([params, searchParams])
  const app = await getAppBySlug(slug)
  if (!app || app.status !== "published") notFound()
  return (
    <a href={`/apps/${app.slug}?from=embed`} target="_top" rel="noopener" className={`${theme === "dark" ? "dark" : ""} flex h-screen w-full items-center gap-3 bg-card px-4 text-card-foreground no-underline`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white"><Star className="size-5 fill-current" /></span>
      <span className="min-w-0 leading-tight">
        <span className="block text-sm font-semibold">{app.ratingsCount ? `${app.rating.toFixed(1)} ★ on PWANova` : "View on PWANova"}</span>
        <span className="block truncate text-xs text-muted-foreground">{app.ratingsCount ? plural(app.ratingsCount, "rating") : app.name}</span>
        <span className="mt-0.5 flex items-center gap-2">
          {app.verificationStatus === "verified" && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand"><BadgeCheck className="size-3" />PWANova Verified</span>}
          {app.isDemo && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground"><FlaskConical className="size-3" />Demo data</span>}
        </span>
      </span>
    </a>
  )
}
