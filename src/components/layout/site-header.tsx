import Link from "next/link"
import { Search, Sparkles } from "lucide-react"
import { Logo } from "./logo"
import { NavLinks } from "./nav-links"
import { ThemeToggle } from "./theme-toggle"
import { buttonVariants } from "@/components/ui/button"
import { getViewer } from "@/lib/data"
import { cn } from "@/lib/utils"

export async function SiteHeader() {
  const viewer = await getViewer()
  return (
    <header className="glass pt-safe sticky top-0 z-40 border-b border-border">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 md:h-16">
        <Link href="/" aria-label="PWANova home"><Logo /></Link>
        <NavLinks />
        <div className="ml-auto flex items-center gap-1.5">
          <form action="/explore" className="relative hidden md:block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q" type="search" placeholder="Search apps, builders, tools…" aria-label="Search"
              className="h-10 w-40 rounded-full border border-transparent bg-muted pr-4 pl-9 text-sm outline-none transition-all placeholder:text-muted-foreground focus:w-56 focus:border-ring focus:bg-background xl:w-56 xl:focus:w-80"
            />
          </form>
          <Link href="/explore?focus=1" aria-label="Search" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "md:hidden")}><Search className="size-[18px]" /></Link>
          <ThemeToggle />
          {viewer ? (
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost" }), "hidden md:inline-flex")}>Dashboard</Link>
          ) : (
            <Link href="/sign-in" className={cn(buttonVariants({ variant: "ghost" }), "hidden md:inline-flex")}>Sign In</Link>
          )}
          <Link href="/ship" className={cn(buttonVariants(), "hidden whitespace-nowrap rounded-full sm:inline-flex")}>
            <Sparkles className="size-4" /> Ship Your App
          </Link>
        </div>
      </div>
    </header>
  )
}
