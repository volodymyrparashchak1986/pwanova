import Link from "next/link"
import { ChevronRight } from "lucide-react"

export function SectionHeader({ title, sub, href, cta = "See all" }: { title: string; sub?: string; href?: string; cta?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
        {sub && <p className="mt-1 text-sm text-muted-foreground md:text-base">{sub}</p>}
      </div>
      {href && <Link href={href} className="inline-flex shrink-0 items-center text-sm font-medium text-brand hover:underline">{cta}<ChevronRight className="size-4" /></Link>}
    </div>
  )
}

export function EmptyState({ title, body, children }: { title: string; body?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-border px-6 py-14 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {body && <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">{body}</p>}
      {children && <div className="mt-5 flex justify-center gap-2">{children}</div>}
    </div>
  )
}

export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 py-8 md:py-12 ${className ?? ""}`}>{children}</div>
}
