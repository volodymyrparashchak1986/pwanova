import type { Metadata } from "next"
import Link from "next/link"
import { PageShell } from "@/components/app/section-header"
import { CATEGORIES } from "@/lib/constants"
import { getCategoryCounts } from "@/lib/data"
import { hueFor } from "@/lib/format"

export const metadata: Metadata = { title: "Categories", description: "Browse web apps by category." }

export default async function CategoriesPage() {
  const counts = await getCategoryCounts()
  return (
    <PageShell>
      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Categories</h1>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map((c) => (
          <Link key={c.slug} href={`/categories/${c.slug}`} className="group relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5">
            <div aria-hidden className="absolute -top-8 -right-8 size-28 rounded-full opacity-25 blur-2xl" style={{ background: `oklch(0.7 0.19 ${hueFor(c.slug)})` }} />
            <h2 className="relative text-lg font-semibold">{c.name}</h2>
            <p className="relative mt-1 text-sm text-muted-foreground">{c.blurb}</p>
            <p className="relative mt-4 text-xs font-medium text-muted-foreground">{counts[c.slug] ?? 0} {counts[c.slug] === 1 ? "app" : "apps"}</p>
          </Link>
        ))}
      </div>
    </PageShell>
  )
}
