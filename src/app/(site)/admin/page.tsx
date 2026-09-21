import type { Metadata } from "next"
import Link from "next/link"
import { AdminButtons } from "@/components/app/admin-actions"
import { PageShell } from "@/components/app/section-header"
import { requireAdmin } from "@/lib/auth"
import { getAdminOverview } from "@/lib/data"
import { timeAgo } from "@/lib/format"

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } }

export default async function AdminPage() {
  await requireAdmin() // server-side gate; RLS is_admin() enforces it again in the database
  const { reports, apps } = await getAdminOverview()
  return (
    <PageShell>
      <h1 className="text-4xl font-semibold tracking-tight">Admin</h1>

      <section className="mt-8"><h2 className="mb-3 text-lg font-semibold">Open reports ({reports.length})</h2>
        <ul className="space-y-3">
          {reports.map((r) => {
            const review = Array.isArray(r.review) ? r.review[0] : r.review
            const app = Array.isArray(r.app) ? r.app[0] : r.app
            return (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
                <p className="text-sm"><span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">{r.reason}</span> <span className="text-muted-foreground">{timeAgo(r.created_at)}</span></p>
                {app && <p className="mt-2 text-sm">App: <Link className="font-semibold hover:underline" href={`/apps/${app.slug}`}>{app.name}</Link></p>}
                {review && <p className="mt-2 line-clamp-3 rounded-xl bg-muted p-3 text-sm">“{review.body}”</p>}
                {r.details && <p className="mt-2 text-sm text-muted-foreground">{r.details}</p>}
                <div className="mt-3 flex flex-wrap gap-3">
                  <AdminButtons id={r.id} actions={[{ kind: "resolve_report", label: "Resolve" }, { kind: "dismiss_report", label: "Dismiss" }]} />
                  {review && <AdminButtons id={review.id} actions={[{ kind: "remove_review", label: "Remove review", danger: true }]} />}
                  {app && <AdminButtons id={app.id} actions={[{ kind: "hide", label: "Hide app" }, { kind: "suspend", label: "Suspend app", danger: true }]} />}
                </div>
              </li>
            )
          })}
          {!reports.length && <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No open reports.</li>}
        </ul>
      </section>

      <section className="mt-12"><h2 className="mb-3 text-lg font-semibold">Apps</h2>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-xs text-muted-foreground"><tr><th className="p-3">App</th><th className="p-3">Status</th><th className="p-3">Verified</th><th className="p-3">Actions</th></tr></thead>
            <tbody>{apps.map((a) => (
              <tr key={a.id} className="border-t border-border align-top">
                <td className="p-3"><Link href={`/apps/${a.slug}`} className="font-medium hover:underline">{a.name}</Link><p className="text-xs text-muted-foreground">{a.domain}{a.is_demo ? " · demo" : ""}{a.is_featured ? " · featured" : ""}</p></td>
                <td className="p-3 capitalize">{a.status}</td>
                <td className="p-3 capitalize">{a.verification_status}</td>
                <td className="p-3"><AdminButtons id={a.id} actions={[
                  ...(a.status !== "published" ? [{ kind: "approve" as const, label: a.status === "pending" ? "Approve" : "Restore" }] : [{ kind: "hide" as const, label: "Hide" }]),
                  ...(a.status !== "suspended" ? [{ kind: "suspend" as const, label: "Suspend", danger: true }] : []),
                  { kind: a.verification_status === "verified" ? "unverify" : "verify", label: a.verification_status === "verified" ? "Unverify" : "Verify" },
                  { kind: a.is_featured ? "unfeature" : "feature", label: a.is_featured ? "Unfeature" : "Feature" },
                ]} /></td>
              </tr>))}</tbody>
          </table>
        </div>
      </section>
    </PageShell>
  )
}
