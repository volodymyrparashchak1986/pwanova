import type { Metadata } from "next"
import Link from "next/link"
import { PageShell } from "@/components/app/section-header"
import { ShipForm } from "@/components/app/ship-form"
import { buttonVariants } from "@/components/ui/button"
import { requireViewer } from "@/lib/auth"
import { isSupabaseConfigured } from "@/lib/env"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Ship your app", description: "Give your live web app a permanent home for discovery, ratings and reviews." }

export default async function ShipPage() {
  if (!isSupabaseConfigured) {
    return (
      <PageShell className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight">Ship Your App</h1>
        <p className="mt-4 rounded-2xl border border-dashed border-border p-6 text-muted-foreground">Submitting needs a connected Supabase project. Follow the README setup, then this form goes live.</p>
        <Link href="/for-developers" className={cn(buttonVariants({ variant: "outline" }), "mt-6 rounded-full")}>See how it works</Link>
      </PageShell>
    )
  }
  const viewer = await requireViewer("/ship")
  return (
    <PageShell className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand">Build anywhere. Launch anywhere. Live on PWANova.</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">Ship Your App</h1>
      <p className="mt-3 mb-10 text-muted-foreground">Start with your live URL. We&apos;ll do the rest.</p>
      <ShipForm userId={viewer.id} />
    </PageShell>
  )
}
