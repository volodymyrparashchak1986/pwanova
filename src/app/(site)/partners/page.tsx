import type { Metadata } from "next"
import { BadgeCheck, BarChart3, Download, Handshake, Link2, MessageSquare, ShieldCheck, Coins } from "lucide-react"
import { PageShell } from "@/components/app/section-header"
import { buttonVariants } from "@/components/ui/button"
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
  [Coins, "Future revenue share", "Referral revenue when developers you send upgrade."],
] as const

export default function PartnersPage() {
  return (
    <PageShell className="max-w-5xl">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-6xl">You help apps launch. <span className="text-brand-gradient">We help them keep growing.</span></h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">Add PWANova ratings, verification and install guidance to your launch platform without rebuilding the infrastructure yourself.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href="mailto:partners@pwanova.app?subject=PWANova%20partnership" className={cn(buttonVariants({ size: "lg" }), "rounded-full")}>Become a Partner</a>
          <a href="#api" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "rounded-full")}>API Docs</a>
        </div>
      </div>

      <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {BENEFITS.map(([Icon, t, b]) => <div key={t} className="rounded-3xl border border-border bg-card p-6"><Icon className="size-6 text-brand" /><h2 className="mt-3 font-semibold">{t}</h2><p className="mt-1 text-sm text-muted-foreground">{b}</p></div>)}
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">Launch boards are partners, not competitors. Product Hunt, Peerlist and friends bring the launch moment; PWANova keeps the app discoverable after it.</p>

      <section id="api" className="mt-20 scroll-mt-24">
        <h2 className="text-3xl font-semibold tracking-tight">Public API</h2>
        <p className="mt-2 text-muted-foreground">Look up a listing by domain. CORS-enabled, cached, rate limited to 60 requests per minute per IP.</p>
        <pre className="mt-5 overflow-x-auto rounded-2xl bg-[oklch(0.17_0.03_275)] p-5 text-[13px] leading-relaxed text-white/90"><code>{`GET /api/public/apps/by-domain?domain=metro-fit.example

{
  "name": "Metro Fit",
  "slug": "metro-fit",
  "rating": 4.8,
  "ratingsCount": 317,
  "reviewsCount": 3,
  "verified": true,
  "installable": true,
  "pwa": true,
  "host": "Vercel",
  "developer": { "username": "novalabs", "name": "Nova Labs", "verifiedOwner": true },
  "url": "https://pwanova.app/apps/metro-fit"
}`}</code></pre>
      </section>

      <section id="badges" className="mt-16 scroll-mt-24">
        <h2 className="text-3xl font-semibold tracking-tight">Embed badges</h2>
        <p className="mt-2 text-muted-foreground">Drop a live rating and verification badge next to any app.</p>
        <pre className="mt-5 overflow-x-auto rounded-2xl bg-[oklch(0.17_0.03_275)] p-5 text-[13px] leading-relaxed text-white/90"><code>{`<iframe src="https://pwanova.app/embed/app/metro-fit"
        width="260" height="72" style="border:0" loading="lazy"
        title="Metro Fit on PWANova"></iframe>`}</code></pre>
        <iframe src="/embed/app/metro-fit" width="260" height="72" style={{ border: 0 }} loading="lazy" title="Embed preview" className="mt-4" />
      </section>

      <section className="mt-16 rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <h2 className="mb-2 text-lg font-semibold text-foreground">Attribution</h2>
        Links like <code>?ref=your-partner</code> or <code>?source=your-partner</code> set a 30-day attribution cookie. Attribution never overwrites an app&apos;s launch source. PWANova tracks <em>launch source</em>, <em>traffic source</em> and <em>referral partner</em> separately.
      </section>
    </PageShell>
  )
}
