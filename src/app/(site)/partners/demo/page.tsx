import type { Metadata } from "next"
import Link from "next/link"
import { FlaskConical } from "lucide-react"
import { AppIcon } from "@/components/app/app-icon"
import { PartnerKit } from "@/components/app/partner-kit"
import { PageShell } from "@/components/app/section-header"
import { Stars } from "@/components/app/stars"
import { exampleApp } from "@/lib/partner-example"

export const metadata: Metadata = { title: "Partner Kit: worked example", robots: { index: false } }

/**
 * A self-contained, clearly-fictional worked example of the Partner Kit: what a launch board's page
 * looks like BEFORE and AFTER adding a PWANova badge. "Vibeboard" is not a real company and is not a
 * PWANova partner — it exists only on this page to demonstrate the integration, the same way a design
 * system's docs show a fake app in a phone frame. The listing it shows is a static, in-code sample
 * (src/lib/partner-example.ts, always marked "demo data" in the badge itself), never a real
 * developer's app and never a database row — so this page works even on a project with no demo data.
 */
export default function PartnerDemoPage() {
  const app = exampleApp

  return (
    <PageShell className="max-w-3xl">
      <p className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground"><FlaskConical className="size-3.5" />Fictional example — “Vibeboard” is not a real company and is not a PWANova partner</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">What integrating looks like</h1>
      <p className="mt-2 text-muted-foreground">A launch board keeps its own page, its own brand and its own upvotes. Adding PWANova is one badge.</p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Before</p>
          <div className="flex items-center gap-3"><AppIcon app={app} size="sm" />
            <div><p className="font-semibold">{app.name}</p><p className="text-sm text-muted-foreground">{app.tagline}</p></div>
            <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-xs font-medium">▲ 214</span>
          </div>
        </div>
        <div className="rounded-3xl border border-brand/30 bg-card p-5 shadow-soft">
          <p className="mb-3 text-xs font-semibold tracking-wide text-brand uppercase">After</p>
          <div className="flex items-center gap-3"><AppIcon app={app} size="sm" />
            <div><p className="font-semibold">{app.name}</p><p className="text-sm text-muted-foreground">{app.tagline}</p></div>
            <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-xs font-medium">▲ 214</span>
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-sm">
            {app.ratingsCount ? <><Stars value={app.rating} size={13} /><span className="font-medium">{app.rating.toFixed(1)}</span><span className="text-muted-foreground">· {app.ratingsCount} ratings on PWANova</span></> : <span className="text-muted-foreground">View on PWANova</span>}
          </div>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">The actual badge, live</h2>
        <p className="mt-1 text-sm text-muted-foreground">These are the real badge and embed endpoints, rendering a fictional sample listing (it says so on the badge). Swap the slug for a real app&apos;s and the snippet works as-is. Pick a format and copy it.</p>
        <div className="mt-4"><PartnerKit apps={[{ slug: app.slug, name: `${app.name} (example)` }]} refCode="vibeboard-demo" /></div>
        <p className="mt-3 text-xs text-muted-foreground">Following the canonical link sets a 30-day referral cookie for <code>vibeboard-demo</code> — the same mechanism a real partner uses — but because no partner named “vibeboard-demo” exists in PWANova&apos;s partner table, it is never counted as an official, attributed partner. See <Link className="underline" href="/partners#api">the attribution model</Link>.</p>
      </section>
    </PageShell>
  )
}
