import { ChevronRight } from "lucide-react"
import { Link } from "@/components/i18n/link"
import { cn } from "@/lib/utils"

export function SectionHeader({ title, sub, href, cta, id }: { title: string; sub?: string; href?: string; cta?: string; id?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 id={id} className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
        {sub && <p className="mt-1 max-w-2xl text-sm text-muted-foreground md:text-base">{sub}</p>}
      </div>
      {href && cta && <Link href={href} className="inline-flex shrink-0 items-center text-sm font-medium text-brand hover:underline">{cta}<ChevronRight className="size-4" aria-hidden /></Link>}
    </div>
  )
}

export function EmptyState({ title, body, children, className }: { title: string; body?: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-3xl border border-dashed border-border px-6 py-14 text-center", className)}>
      <p className="text-lg font-semibold">{title}</p>
      {body && <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">{body}</p>}
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  )
}

export function PageShell({ children, className, wide = false }: { children: React.ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn("mx-auto w-full px-4 py-8 md:py-12", wide ? "max-w-7xl" : "max-w-6xl", className)}>{children}</div>
}

export function PageHeader({ title, body, eyebrow, children }: { title: string; body?: string; eyebrow?: string; children?: React.ReactNode }) {
  return (
    <header className="mb-8">
      {eyebrow && <p className="mb-2 text-sm font-semibold tracking-widest text-brand uppercase">{eyebrow}</p>}
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-5xl">{title}</h1>
      {body && <p className="mt-3 max-w-3xl text-muted-foreground md:text-lg">{body}</p>}
      {children}
    </header>
  )
}

/**
 * A table in long-form copy. From 640px it is a table; below that every row is a small list that names
 * each value, so a narrow screen never has to scroll sideways. Only one of the two is rendered visibly
 * and exposed to assistive technology at a time.
 */
export function ProseTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <>
      <table className="hidden sm:table">
        <thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody>
      </table>
      <div className="mt-4 space-y-3 sm:hidden">
        {rows.map((row, i) => (
          <dl key={i} className="rounded-2xl border border-border/70 bg-card p-4 text-sm">
            {row.map((cell, j) => (
              <div key={j} className={j ? "mt-2.5" : undefined}>
                <dt className="text-xs font-semibold text-muted-foreground">{head[j]}</dt>
                <dd className="mt-0.5 break-words">{cell}</dd>
              </div>
            ))}
          </dl>
        ))}
      </div>
    </>
  )
}

/** Long-form copy (methodology, legal, rules): readable line length and consistent heading rhythm. */
export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "max-w-3xl text-[15px] leading-relaxed text-foreground/90 [&_a]:font-medium [&_a]:text-brand [&_a]:underline-offset-2 hover:[&_a]:underline [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:mt-1.5 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-3 [&_strong]:text-foreground [&_table]:mt-4 [&_table]:w-full [&_table]:text-sm [&_td]:border-b [&_td]:border-border/70 [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top [&_th]:border-b [&_th]:border-border [&_th]:py-2 [&_th]:pr-4 [&_th]:text-left [&_th]:font-semibold [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5",
      className,
    )}>{children}</div>
  )
}
