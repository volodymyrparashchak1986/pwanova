import type { Metadata } from "next"
import Link from "next/link"
import { Check } from "lucide-react"
import { PageShell } from "@/components/app/section-header"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Pricing", description: "Free for every developer. Upgrade when you need deeper analytics and reach." }

const PLANS = [
  { name: "Free", price: "$0", note: "For every builder", cta: "Ship Your App", href: "/ship", features: ["1–3 apps", "Ratings", "Reviews", "Basic analytics"] },
  { name: "Pro", price: "Coming soon", note: "For serious projects", cta: "Join the waitlist", href: "mailto:hello@pwanova.app?subject=PWANova%20Pro", highlight: true, features: ["Advanced analytics", "Verified developer", "More apps", "Traffic sources", "Enhanced developer profile", "Priority checks"] },
  { name: "Launch", price: "Coming soon", note: "For launch moments", cta: "Talk to us", href: "mailto:hello@pwanova.app?subject=PWANova%20Launch", features: ["Featured placement", "Homepage exposure", "Launch campaign analytics"] },
  { name: "Partner", price: "Let's talk", note: "For launch boards", cta: "Become a Partner", href: "/partners", features: ["API access", "Partner branding", "Bulk import", "Attribution dashboard"] },
]

export default function PricingPage() {
  return (
    <PageShell>
      <div className="text-center"><h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Simple pricing</h1><p className="mt-3 text-muted-foreground">Everything you need to get discovered is free. Paid plans are not live yet, and no payment is collected.</p></div>
      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => (
          <div key={p.name} className={cn("flex flex-col rounded-3xl border bg-card p-6", p.highlight ? "border-brand shadow-lg" : "border-border")}>
            <h2 className="text-lg font-semibold">{p.name}</h2>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{p.price}</p>
            <p className="text-sm text-muted-foreground">{p.note}</p>
            <ul className="mt-5 flex-1 space-y-2.5 text-sm">{p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand" />{f}</li>)}</ul>
            <Link href={p.href} className={cn(buttonVariants({ variant: p.highlight ? "default" : "outline" }), "mt-6 rounded-full")}>{p.cta}</Link>
          </div>
        ))}
      </div>
    </PageShell>
  )
}
