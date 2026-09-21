import Link from "next/link"
import { Logo } from "./logo"

const COLS = [
  { title: "Discover", links: [["Explore", "/explore"], ["Top Apps", "/top"], ["Trending", "/trending"], ["New & Rising", "/new"], ["Categories", "/categories"]] },
  { title: "Developers", links: [["Ship Your App", "/ship"], ["For Developers", "/for-developers"], ["Dashboard", "/dashboard"], ["Pricing", "/pricing"]] },
  { title: "Partners", links: [["Launch boards", "/partners"], ["Public API", "/partners#api"], ["Embed badges", "/partners#badges"]] },
]

export function SiteFooter() {
  return (
    <footer className="mt-24 hidden border-t border-border md:block">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">The distribution layer for the open web. Discover. Trust. Install.</p>
          <p className="mt-6 text-xs text-muted-foreground">Traditional app stores remain important. PWANova gives modern web apps another path to be found and trusted.</p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <h3 className="text-sm font-semibold">{c.title}</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {c.links.map(([label, href]) => <li key={href}><Link className="hover:text-foreground" href={href}>{label}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border py-5 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} PWANova. Third-party names are used for attribution only and do not imply endorsement.</div>
    </footer>
  )
}
