import { CompareTray } from "@/components/compare/compare-tray"
import { DemoBanner } from "@/components/layout/demo-banner"
import { MobileNav } from "@/components/layout/mobile-nav"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DemoBanner />
      <SiteHeader />
      <main id="content" className="flex-1">{children}</main>
      <SiteFooter />
      <CompareTray />
      <MobileNav />
    </>
  )
}
