import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { AppCard } from "@/components/app/app-card"
import { EmptyState, PageShell } from "@/components/app/section-header"
import { CATEGORIES } from "@/lib/constants"
import { getApps } from "@/lib/data"

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const cat = CATEGORIES.find((c) => c.slug === slug)
  if (!cat) return {}
  return {
    title: `${cat.name} apps`,
    description: `${cat.blurb} Discover the best ${cat.name.toLowerCase()} web apps and PWAs on PWANova.`,
    alternates: { canonical: `/categories/${slug}` },
  }
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params
  const cat = CATEGORIES.find((c) => c.slug === slug)
  if (!cat) notFound()
  const apps = await getApps({ category: slug, sort: "top", limit: 60 })
  return (
    <PageShell>
      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{cat.name}</h1>
      <p className="mt-2 text-muted-foreground">{cat.blurb}</p>
      <div className="mt-8">
        {apps.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{apps.map((a) => <AppCard key={a.id} app={a} />)}</div> : <EmptyState title={`No ${cat.name} apps yet`} body="Be the first to ship one." />}
      </div>
    </PageShell>
  )
}
