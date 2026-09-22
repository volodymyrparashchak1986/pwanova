import type { Metadata } from "next"
import Link from "next/link"
import { BadgeCheck, BarChart3, Download, Handshake, Link2, MessageSquare, ShieldCheck, Coins } from "lucide-react"
import { PageShell } from "@/components/app/section-header"
import { PartnerKit } from "@/components/app/partner-kit"
import { buttonVariants } from "@/components/ui/button"
import { getApps } from "@/lib/data"
import { exampleApp } from "@/lib/partner-example"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Launch board partners", description: "You help apps launch. PWANova helps them keep growing. Add ratings, verification and install guidance to your launch platform." }

const BENEFITS = [
  [BadgeCheck, "Free rating badge", "Embed a live PWANova rating next to every listing."],
  [ShieldCheck, "Verified app metadata", "Ownership and web-app quality signals you don't have to build."],
  [Download, "Installation guidance", "Platform-aware install help for iOS, Android and desktop."],
  [BarChart3, "App quality data", "HTTPS, manifest, installability and health, via API."],
  [MessageSquare, "Ratings & reviews", "Ongoing reputation that outlives launch day."],
  [Link2, "Attribution", "“Launched on you” shown on every app you send."],
  [Handshake, "Referral traffic", "Visitors from your links are tracked back to you."],
  [Coins, "Future revenue share", "Referral revenue when developers you send upgrade — schema is ready, billing is not built yet."],
] as const

export default async function PartnersPage() {
  const apps = await getApps({ sort: "top", limit: 8 })
  return (
    <PageShell className="max-w-5xl">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-6xl">You help apps launch. <span className="text-brand-gradient">We help them keep growing.</span></h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">Add PWANova ratings, verification and install guidance to your launch platform without rebuilding the infrastructure yourself.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href="mailto:partners@pwanova.app?subject=PWANova%20partnership" className={cn(buttonVariants({ size: "lg" }), "rounded-full")}>Become a Partner</a>
          <a href="#api" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "rounded-full")}>API Docs</a>
          <Link href="/partners/demo" className={cn(buttonVariants({ size: "lg", variant: "ghost" }), "rounded-full")}>See a worked example →</Link>
        </div>
      </div>

      <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {BENEFITS.map(([Icon, t, b]) => <div key={t} className="rounded-3xl border border-border bg-card p-6"><Icon className="size-6 text-brand" /><h2 className="mt-3 font-semibold">{t}</h2><p className="mt-1 text-sm text-muted-foreground">{b}</p></div>)}
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">Launch boards are partners, not competitors. Product Hunt, Peerlist and friends bring the launch moment; PWANova keeps the app discoverable after it. Integrating doesn&apos;t mean moving your catalog — your page, your brand and your upvotes stay exactly where they are; PWANova adds durable reviews, ownership verification and install guidance next to them.</p>

      <section className="mt-16">
        <h2 className="text-3xl font-semibold tracking-tight">Try it</h2>
        <p className="mt-2 text-muted-foreground">Pick a listing and a format. Copy the snippet straight into your page.{!apps.length && " No apps are listed yet, so the preview uses a fictional sample — the snippet works unchanged once you swap in a real slug."}</p>
        <div className="mt-5"><PartnerKit apps={apps.length ? apps.map((a) => ({ slug: a.slug, name: a.name })) : [{ slug: exampleApp.slug, name: `${exampleApp.name} (example)` }]} /></div>
      </section>

      <section id="api" className="mt-20 scroll-mt-24">
        <h2 className="text-3xl font-semibold tracking-tight">Public API</h2>
        <p className="mt-2 text-muted-foreground">Look up a listing by domain. Public fields only — no email, no user IDs, no verification tokens. CORS-enabled, cached, rate limited to 60 requests per minute per IP. A hidden, suspended, pending or rejected app 404s here, in the badge and in the embed, the same as it does on the site.</p>
        <CopyableExample />
        <ul className="mt-5 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li><code>rating</code> is <code>null</code> (not <code>0</code>) when there are no ratings yet — show “No ratings yet”, not a zero-star average.</li>
          <li><code>checks.*</code> fields are <code>true</code>, <code>false</code> or <code>null</code>. <code>null</code> means unknown/not checked — never render it as a pass.</li>
          <li><code>demo: true</code> only appears if the responding deployment has fabricated demo data turned on (<code>SHOW_DEMO_DATA</code>); a real launch board integrating with a live PWANova instance will never see it.</li>
          <li>404 → not found (or not public). 429 → rate limited, back off using the response&apos;s <code>Retry-After</code>.</li>
        </ul>
      </section>

      <section id="badges" className="mt-16 scroll-mt-24">
        <h2 className="text-3xl font-semibold tracking-tight">Embed badges</h2>
        <p className="mt-2 text-muted-foreground">Two ways to show a live rating next to a listing: an <code>&lt;iframe&gt;</code> (part of the generator above), or a plain SVG image behind a link — no JavaScript, no tracking script, just an <code>&lt;img&gt;</code> your CMS can already render.</p>
        <pre className="mt-5 overflow-x-auto rounded-2xl bg-[oklch(0.17_0.03_275)] p-5 text-[13px] leading-relaxed text-white/90"><code>{`<a href="https://pwanova.app/apps/metro-fit" target="_blank" rel="noopener">
  <img src="https://pwanova.app/api/badge/metro-fit" width="220" height="60"
       alt="View on PWANova">
</a>`}</code></pre>
      </section>

      <section className="mt-16 rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <h2 className="mb-2 text-lg font-semibold text-foreground">Attribution: four different things</h2>
        <dl className="mt-3 space-y-2">
          <div><dt className="font-medium text-foreground">Launch source</dt><dd>Where the app first launched (e.g. “Launched on Product Hunt”). Set once by the developer; a later referral link never overwrites it.</dd></div>
          <div><dt className="font-medium text-foreground">Discovery source</dt><dd>Where PWANova&apos;s listing itself came from, when different from the launch (e.g. discovered via a partner feed rather than launched there).</dd></div>
          <div><dt className="font-medium text-foreground">Referral partner</dt><dd>Who sent a given visit or signup right now — set by <code>?ref=your-partner</code> or <code>?source=your-partner</code> (30-day cookie). Only codes that match a real row in PWANova&apos;s partner table become an official, attributed partner; an arbitrary <code>?ref=anything</code> is stored but never treated as one.</dd></div>
          <div><dt className="font-medium text-foreground">Traffic channel</dt><dd>The bucket a single visit is classified into (partner, search, homepage, social, direct, …) — how the dashboard&apos;s traffic-sources chart is built.</dd></div>
        </dl>
      </section>
    </PageShell>
  )
}

function CopyableExample() {
  return (
    <pre className="mt-5 overflow-x-auto rounded-2xl bg-[oklch(0.17_0.03_275)] p-5 text-[13px] leading-relaxed text-white/90"><code>{`GET /api/public/apps/by-domain?domain=metro-fit.example

{
  "id": "…",
  "name": "Metro Fit",
  "slug": "metro-fit",
  "rating": 4.8,
  "ratingsCount": 317,
  "reviewsCount": 3,
  "verified": true,
  "installable": true,
  "pwa": true,
  "host": "Vercel",
  "checks": { "reachable": true, "httpsOk": true, "manifestOk": true, "serviceWorkerOk": true,
              "installable": true, "offlineSupport": null, "pushSupport": null },
  "lastCheckedAt": "2026-09-21T22:10:00.000Z",
  "developer": { "username": "novalabs", "name": "Nova Labs", "verifiedOwner": true },
  "demo": false,
  "url": "https://pwanova.app/apps/metro-fit",
  "installGuidanceUrl": "https://pwanova.app/apps/metro-fit#install",
  "badgeUrl": "https://pwanova.app/api/badge/metro-fit",
  "embedUrl": "https://pwanova.app/embed/app/metro-fit"
}`}</code></pre>
  )
}
