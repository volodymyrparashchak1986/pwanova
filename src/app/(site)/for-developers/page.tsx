import type { Metadata } from "next"
import Link from "next/link"
import { BadgeCheck, BarChart3, Compass, MessageSquareText, Rocket, ShieldCheck, Star, Smartphone, Layers } from "lucide-react"
import { PageShell } from "@/components/app/section-header"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "For developers",
  description: "Your app is already live. PWANova helps people discover it, trust it and come back to it.",
}

const BENEFITS = [
  { icon: Layers, title: "Keep your existing deployment", body: "Vercel, Cloudflare, Netlify, Firebase, Railway, Render or your own domain. Nothing to migrate." },
  { icon: Smartphone, title: "No native rewrite required", body: "Reach phones and desktops as an installable web app. Add native later, if you ever need it." },
  { icon: Star, title: "Build reputation", body: "A permanent home for your app's rating, reviews and developer profile." },
  { icon: MessageSquareText, title: "Collect ratings and get reviews", body: "Real, signed-in people. Reply publicly as the verified owner." },
  { icon: BarChart3, title: "Understand traffic, measure opens", body: "See views, opens, install actions and where visitors came from." },
  { icon: Compass, title: "Get discovered", body: "Search, categories, trending and top lists filterable by build tool, host and launch source." },
  { icon: ShieldCheck, title: "Claim your app", body: "Already listed? Prove domain ownership by serving one small text file on your own origin." },
  { icon: BadgeCheck, title: "Ownership verified", body: "Proof of origin control, displayed separately from technical checks. Not a security audit." },
]

export default function ForDevelopersPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 -top-32 mx-auto h-96 max-w-3xl rounded-full bg-brand-gradient opacity-20 blur-[100px]" />
        <div className="relative mx-auto max-w-3xl px-4 pt-16 pb-14 text-center md:pt-24">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand">Build anywhere. Launch anywhere. Live on PWANova.</p>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight md:text-6xl">Your app is already live. Now give people a place to discover it.</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">PWANova helps people discover it, trust it and come back to it.</p>
          <Link href="/ship" className={cn(buttonVariants({ size: "lg" }), "mt-8 rounded-full")}><Rocket className="size-4" />Ship Your App</Link>
        </div>
      </section>

      <PageShell className="pt-0">
        <p className="mx-auto mb-10 max-w-2xl text-center text-muted-foreground">
          Made with v0, Claude Code, Codex, Cursor, Lovable, Bolt, Replit or Windsurf? Launch boards help apps get noticed. PWANova helps them stay discovered.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-3xl border border-border bg-card p-6 shadow-soft">
              <span className="grid size-10 place-items-center rounded-xl bg-brand/10 text-brand"><Icon className="size-5" /></span>
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 grid items-center gap-8 rounded-[2rem] border border-border bg-card p-8 md:grid-cols-2 md:p-12">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Three steps</h2>
            <ol className="mt-5 space-y-4">
              {["Paste your live URL. We read your title, icon, manifest and host.", "Ship it. Your listing goes live with quality checks.", "Verify your domain with a one-line file at /.well-known/ to unlock developer replies, analytics and the Ownership verified badge."].map((t, i) => (
                <li key={i} className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span><span className="text-muted-foreground">{t}</span></li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl bg-muted p-5 font-mono text-[13px] leading-relaxed">
            <p className="text-muted-foreground">{"# https://your-app.example/.well-known/pwanova-verification.txt"}</p>
            <p className="mt-1 break-all">{"<your claim token, one line, nothing else>"}</p>
            <p className="mt-3 text-muted-foreground">{"# the token is issued on your app's Claim page and stays valid for 3 days"}</p>
          </div>
        </div>
        <div className="mt-12 text-center"><Link href="/ship" className={cn(buttonVariants({ size: "lg" }), "rounded-full")}>Ship Your App</Link></div>
      </PageShell>
    </>
  )
}
