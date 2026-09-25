import Link from "next/link"
import { ArrowRight, Globe2, RefreshCw, Search, ShieldCheck, Smartphone, Zap } from "lucide-react"
import { AppCard, AppRow } from "@/components/app/app-card"
import { AppIcon } from "@/components/app/app-icon"
import { CommunityReviews } from "@/components/app/community-reviews"
import { SectionHeader } from "@/components/app/section-header"
import { buttonVariants } from "@/components/ui/button"
import { BUILD_TOOLS, CATEGORIES } from "@/lib/constants"
import { getApps, getCommunityReviews, getFeaturedApps } from "@/lib/data"
import { cn } from "@/lib/utils"

export default async function HomePage() {
  const [featured, top, trending, fresh, community] = await Promise.all([
    getFeaturedApps(6),
    getApps({ sort: "top", limit: 5 }),
    getApps({ sort: "trending", limit: 5 }),
    getApps({ sort: "new", limit: 5 }),
    getCommunityReviews(3, 3),
  ])

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[520px] max-w-5xl rounded-full bg-brand-gradient opacity-20 blur-[120px]" />
        <div className="relative mx-auto max-w-4xl px-4 pt-14 pb-16 text-center md:pt-24 md:pb-24">
          <p className="animate-rise mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-brand-gradient" /> Discover. Trust. Install.
          </p>
          <h1 className="animate-rise mt-6 text-balance text-5xl font-semibold tracking-tight [animation-delay:60ms] md:text-7xl">
            Discover the next generation of <span className="text-brand-gradient">apps.</span>
          </h1>
          <p className="animate-rise mx-auto mt-5 max-w-2xl text-balance text-lg text-muted-foreground [animation-delay:120ms] md:text-xl">
            Modern web apps you can discover, trust and use across devices.
          </p>
          <form action="/explore" className="animate-rise mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-5 shadow-soft [animation-delay:180ms] md:hidden">
            <Search className="size-4 text-muted-foreground" />
            <input name="q" type="search" placeholder="Search apps, tools, builders" aria-label="Search" className="h-10 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground" />
          </form>
          <div className="animate-rise mt-8 flex flex-wrap items-center justify-center gap-3 [animation-delay:240ms]">
            <Link href="/explore" className={cn(buttonVariants({ size: "lg" }), "rounded-full")}>Explore Apps <ArrowRight className="size-4" /></Link>
            <Link href="/ship" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "rounded-full")}>Ship Your App</Link>
          </div>
          <div className="animate-rise mt-12 flex items-center justify-center -space-x-3 [animation-delay:300ms] max-sm:[&>*:nth-child(n+6)]:hidden" aria-hidden>
            {[...new Map([...top, ...featured, ...trending].map((x) => [x.id, x])).values()].slice(0, 7).map((a, i) => (
              <AppIcon key={a.id} app={a} size="md" className={cn("ring-4 ring-background", i % 2 ? "translate-y-2" : "-translate-y-1")} />
            ))}
          </div>
        </div>
      </section>

      {/* BUILT FOR THE OPEN WEB */}
      <section className="mx-auto max-w-3xl px-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">Built for the open web.</p>
        <p className="mt-3 text-balance text-2xl font-semibold tracking-tight md:text-3xl">Apps no longer need to disappear after launch day.</p>
        <p className="mt-3 text-balance text-muted-foreground md:text-lg">PWANova gives modern web apps a permanent home for discovery, ratings, reviews and distribution.</p>
      </section>

      {/* FEATURED */}
      <section className="mx-auto mt-20 max-w-6xl px-4">
        <SectionHeader title="Featured Apps" sub="Hand-picked, well-built web apps." href="/top" cta="Top apps" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{featured.map((a) => <AppCard key={a.id} app={a} from="home" className="animate-rise" />)}</div>
      </section>

      {/* LISTS */}
      <section className="mx-auto mt-20 grid max-w-6xl gap-10 px-4 lg:grid-cols-3">
        <div>
          <SectionHeader title="Top Apps" href="/top" />
          <div className="-mx-2.5">{top.map((a, i) => <AppRow key={a.id} app={a} rank={i + 1} from="home" />)}</div>
        </div>
        <div>
          <SectionHeader title="Trending" sub="Last 7 days" href="/trending" />
          <div className="-mx-2.5">{trending.map((a, i) => <AppRow key={a.id} app={a} rank={i + 1} from="home" />)}</div>
        </div>
        <div>
          <SectionHeader title="New & Rising" href="/new" />
          <div className="-mx-2.5">{fresh.map((a) => <AppRow key={a.id} app={a} from="home" />)}</div>
        </div>
      </section>

      {/* COMMUNITY REVIEWS: real reviews of the top three apps, up to three each */}
      <CommunityReviews data={community} />

      {/* FUTURE OF APPS */}
      <section className="mx-auto mt-24 max-w-6xl px-4">
        <div className="relative overflow-hidden rounded-[2rem] bg-[oklch(0.17_0.03_275)] px-6 py-14 text-white md:px-14 md:py-20">
          <div aria-hidden className="absolute -top-24 -right-24 size-96 rounded-full bg-brand-gradient opacity-40 blur-[90px]" />
          <div className="relative">
            <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-tight md:text-5xl">The web is becoming the universal app platform.</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                { icon: Zap, title: "Publish instantly", body: "No traditional store review queue required." },
                { icon: RefreshCw, title: "Update instantly", body: "Deploy new versions without waiting for app store approval." },
                { icon: Smartphone, title: "One app. Every device.", body: "Web apps can work across desktop, tablet and mobile." },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                  <Icon className="size-6 text-[oklch(0.8_0.13_215)]" />
                  <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm text-white/70">{body}</p>
                </div>
              ))}
            </div>
            <p className="mt-10 max-w-2xl text-white/70">
              Traditional app stores remain important, but modern web apps give developers another distribution path. PWANova provides the missing discovery and trust layer.
            </p>
          </div>
        </div>
      </section>

      {/* BROWSE */}
      <section className="mx-auto mt-20 max-w-6xl px-4">
        <SectionHeader title="Browse categories" href="/categories" />
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => <Link key={c.slug} href={`/categories/${c.slug}`} className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-brand/40 hover:text-brand">{c.name}</Link>)}
        </div>
        <h3 className="mt-10 mb-3 text-sm font-semibold text-muted-foreground">Or browse by what it was built with</h3>
        <div className="flex flex-wrap gap-2">
          {BUILD_TOOLS.filter((b) => b.slug !== "other").map((b) => <Link key={b.slug} href={`/explore?build=${b.slug}`} className="rounded-full bg-muted px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">Built with {b.name}</Link>)}
        </div>
      </section>

      {/* TRUST + DEV CTA */}
      <section className="mx-auto mt-24 grid max-w-6xl gap-4 px-4 md:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-soft">
          <ShieldCheck className="size-7 text-brand" />
          <h3 className="mt-4 text-xl font-semibold">Trust you can see</h3>
          <p className="mt-2 text-muted-foreground">Real ratings and reviews from signed-in people, verified domain ownership, and live web-app quality checks on every listing.</p>
          <Link href="/explore?verified=1" className="mt-5 inline-flex items-center text-sm font-medium text-brand hover:underline">Browse verified apps <ArrowRight className="ml-1 size-4" /></Link>
        </div>
        <div className="rounded-3xl bg-brand-gradient p-8 text-white shadow-soft">
          <Globe2 className="size-7" />
          <h3 className="mt-4 text-xl font-semibold">Launch anywhere. Live on PWANova.</h3>
          <p className="mt-2 text-white/85">Keep your deployment. Get a permanent home for ratings, reviews, verification and traffic insight.</p>
          <Link href="/for-developers" className={cn(buttonVariants({ variant: "secondary" }), "mt-5 rounded-full bg-white text-[oklch(0.17_0.03_275)] hover:bg-white/90 hover:text-[oklch(0.17_0.03_275)]")}>For Developers</Link>
        </div>
      </section>
    </>
  )
}
