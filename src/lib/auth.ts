import { redirect } from "next/navigation"
import { getViewer } from "@/lib/data"

export async function requireViewer(next = "/") {
  const viewer = await getViewer()
  if (!viewer) redirect(`/sign-in?next=${encodeURIComponent(next)}`)
  return viewer
}

export async function requireAdmin() {
  const viewer = await requireViewer("/admin")
  if (viewer.role !== "admin") redirect("/")
  return viewer
}
