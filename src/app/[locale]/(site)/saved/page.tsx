import type { Metadata } from "next"
import { EmptyState, PageHeader, PageShell } from "@/components/app/section-header"
import { SignedOutCard } from "@/components/app/signed-out"
import { AppCard, AppRow } from "@/components/catalog/app-card"
import { SavedComparisons } from "@/components/compare/saved-comparisons"
import { Link } from "@/components/i18n/link"
import { buttonVariants } from "@/components/ui/button"
import { isLocale } from "@/i18n/config"
import { getDictionary, getI18n } from "@/i18n/server"
import { getViewer } from "@/lib/data"
import { getFollowedCatalog, getSavedCatalog, getSavedComparisons } from "@/lib/data/account"
import { getPublicSettings } from "@/lib/data/catalog"
import { privateMetadata } from "@/lib/seo"
import { cn } from "@/lib/utils"

export async function generateMetadata({ params }: PageProps<"/[locale]/saved">): Promise<Metadata> {
  const { locale } = await params
  return privateMetadata(isLocale(locale) ? getDictionary(locale).saved.title : "Saved")
}

export default async function SavedPage() {
  const [{ t }, viewer, settings] = await Promise.all([getI18n(), getViewer(), getPublicSettings()])
  if (!viewer) return <PageShell><SignedOutCard title={t.saved.title} body={t.saved.signInBody} next="/saved" /></PageShell>
  const [apps, following, comparisons] = await Promise.all([getSavedCatalog(viewer.id), getFollowedCatalog(viewer.id), getSavedComparisons(viewer.id)])
  return (
    <PageShell>
      <PageHeader title={t.saved.title} />
      <section aria-labelledby="saved-h">
        <h2 id="saved-h" className="sr-only">{t.saved.apps}</h2>
        {apps.length
          ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{apps.map((a) => <AppCard key={a.id} app={a} signedIn saved compareEnabled={settings.features.compare} />)}</div>
          : <EmptyState title={t.saved.empty}><Link href="/discover" className={cn(buttonVariants(), "rounded-full")}>{t.saved.emptyCta}</Link></EmptyState>}
      </section>
      <section className="mt-12" aria-labelledby="following-h">
        <h2 id="following-h" className="text-xl font-semibold tracking-tight">{t.saved.following}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.saved.followingBody}</p>
        {following.length
          ? <div className="-mx-2.5 mt-3 grid sm:grid-cols-2">{following.map((a) => <AppRow key={a.id} app={a} />)}</div>
          : <p className="mt-3 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">{t.saved.emptyFollowing}</p>}
      </section>
      {settings.features.compare && <SavedComparisons items={comparisons} />}
    </PageShell>
  )
}
