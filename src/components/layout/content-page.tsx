import { TriangleAlert } from "lucide-react"
import { PageHeader, PageShell, Prose } from "@/components/app/section-header"

/** Frame for long-form pages: methodology, ranking, rules and the legal templates. */
export function ContentPage({ title, intro, notice, updated, children }: { title: string; intro?: string; notice?: string; updated?: string; children: React.ReactNode }) {
  return (
    <PageShell className="max-w-4xl">
      <PageHeader title={title} body={intro} />
      {notice && (
        <p role="note" className="mb-8 flex max-w-3xl items-start gap-2.5 rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden /><span>{notice}</span>
        </p>
      )}
      <Prose>{children}</Prose>
      {updated && <p className="mt-10 text-xs text-muted-foreground">{updated}</p>}
    </PageShell>
  )
}
