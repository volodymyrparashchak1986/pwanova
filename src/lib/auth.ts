import { redirect } from "next/navigation"
import { localizeHref } from "@/i18n/config"
import { getLocale } from "@/i18n/server"
import { getViewer } from "@/lib/data"

/** The signed-in viewer, or a redirect to the sign-in page in the visitor's language. `next` has no locale prefix. */
export async function requireViewer(next = "/") {
  const viewer = await getViewer()
  if (!viewer) {
    const locale = await getLocale()
    redirect(`${localizeHref("/sign-in", locale)}?next=${encodeURIComponent(localizeHref(next, locale))}`)
  }
  return viewer
}

export async function requireAdmin() {
  const viewer = await requireViewer("/admin")
  if (viewer.role !== "admin") redirect(localizeHref("/", await getLocale()))
  return viewer
}

/** Moderators and admins. The database enforces the same rule on every write. */
export async function requireModerator() {
  const viewer = await requireViewer("/admin")
  if (viewer.role !== "admin" && viewer.role !== "moderator") redirect(localizeHref("/", await getLocale()))
  return viewer
}
