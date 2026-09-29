import { Bell, Search, Sparkles } from "lucide-react"
import { Link } from "@/components/i18n/link"
import { LocaleSwitcher } from "./locale-switcher"
import { Logo } from "./logo"
import { NavLinks } from "./nav-links"
import { ThemeToggle } from "./theme-toggle"
import { buttonVariants } from "@/components/ui/button"
import { getI18n } from "@/i18n/server"
import { getViewer } from "@/lib/data"
import { getPublicSettings } from "@/lib/data/catalog"
import { getUnreadCount } from "@/lib/data/account"
import { cn } from "@/lib/utils"

export async function SiteHeader() {
  const [{ t, href }, viewer, settings] = await Promise.all([getI18n(), getViewer(), getPublicSettings()])
  const unread = viewer ? await getUnreadCount() : 0
  const hidden = [!settings.features.launches && "launches", !settings.features.requests && "requests", !settings.features.compare && "compare"].filter(Boolean) as string[]
  return (
    <header className="glass pt-safe sticky top-0 z-40 border-b border-border">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-soft">{t.common.skipToContent}</a>
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 md:h-16">
        <Link href="/" aria-label={`${t.common.siteName} · ${t.nav.home}`}><Logo /></Link>
        <NavLinks hidden={hidden} />
        <div className="ml-auto flex items-center gap-1">
          <form action={href("/discover")} className="relative hidden 2xl:block" role="search">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q" type="search" placeholder={t.nav.searchShort} aria-label={t.common.search}
              className="h-10 w-56 rounded-full border border-transparent bg-muted pr-4 pl-9 text-sm outline-none transition-all placeholder:text-muted-foreground focus:w-72 focus:border-ring focus:bg-background"
            />
          </form>
          <Link href="/discover?focus=1" aria-label={t.common.search} className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "2xl:hidden")}><Search className="size-[18px]" /></Link>
          <LocaleSwitcher className="max-sm:hidden" />
          <ThemeToggle className="max-xl:hidden" />
          {viewer ? (
            <>
              <Link href="/notifications" aria-label={`${t.nav.notifications}${unread ? ` (${unread})` : ""}`} className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")}>
                <Bell className="size-[18px]" />
                {unread > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-brand" aria-hidden />}
              </Link>
              <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost" }), "hidden md:inline-flex")}>{t.nav.dashboard}</Link>
            </>
          ) : (
            <Link href="/sign-in" className={cn(buttonVariants({ variant: "ghost" }), "hidden md:inline-flex")}>{t.nav.signIn}</Link>
          )}
          <Link href="/submit" className={cn(buttonVariants(), "hidden whitespace-nowrap rounded-full sm:inline-flex")}>
            <Sparkles className="size-4" /><span className="hidden xl:inline">{t.nav.submitApp}</span><span className="xl:hidden">{t.nav.submitShort}</span>
          </Link>
        </div>
      </div>
    </header>
  )
}
