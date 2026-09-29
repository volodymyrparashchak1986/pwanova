import { Link } from "@/components/i18n/link"
import { LocaleSwitcher } from "./locale-switcher"
import { Logo } from "./logo"
import { NewsletterForm } from "./newsletter-form"
import { ThemeToggle } from "./theme-toggle"
import { getI18n } from "@/i18n/server"
import { getPublicSettings } from "@/lib/data/catalog"

export async function SiteFooter() {
  const [{ t }, settings] = await Promise.all([getI18n(), getPublicSettings()])
  const l = t.footer.links
  const columns = [
    { title: t.footer.columns.discover, links: [[l.discover, "/discover"], [l.categories, "/categories"], settings.features.compare && [l.compare, "/compare"], settings.features.launches && [l.launches, "/launches"], settings.features.requests && [l.requests, "/requests"]] },
    { title: t.footer.columns.makers, links: [[l.submit, "/submit"], [l.forMakers, "/for-makers"], [l.pricing, "/pricing"], [l.dashboard, "/dashboard"], [l.partners, "/partners"]] },
    { title: t.footer.columns.transparency, links: [[l.methodology, "/verification-methodology"], [l.ranking, "/how-ranking-works"], [l.sponsorship, "/sponsorship"], [l.reviewRules, "/review-rules"]] },
    { title: t.footer.columns.legal, links: [[l.imprint, "/legal/imprint"], [l.privacy, "/legal/privacy"], [l.terms, "/legal/terms"]] },
  ]
  return (
    <footer className="mt-24 border-t border-border pb-24 lg:pb-0">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-2 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">{t.footer.about}</p>
          <p className="mt-4 max-w-sm text-xs text-muted-foreground">{t.footer.disclaimer}</p>
          <div className="mt-5 flex items-center gap-2"><LocaleSwitcher full /><ThemeToggle /></div>
        </div>
        {columns.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="text-sm font-semibold">{c.title}</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {c.links.filter((x): x is [string, string] => Boolean(x)).map(([label, href]) => <li key={href}><Link className="hover:text-foreground" href={href}>{label}</Link></li>)}
            </ul>
          </nav>
        ))}
      </div>
      {settings.features.newsletter && (
        <div className="border-t border-border">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h2 className="text-sm font-semibold">{t.footer.newsletterTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t.footer.newsletterBody}</p>
            </div>
            <NewsletterForm source="footer" />
          </div>
        </div>
      )}
      <div className="border-t border-border px-4 py-5 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} PWANova. {t.footer.rights}</div>
    </footer>
  )
}
