import type { NextRequest } from "next/server"
import { getAppDetail, getEvidenceHistory } from "@/lib/data/catalog"
import { API_VERSION, apiError, evidenceItem, json, limited, preflight } from "@/lib/v2/api"

export const OPTIONS = preflight

/** GET /api/v1/apps/{slug}/evidence — the evidence history: current and replaced entries, newest first. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/v1/apps/[slug]/evidence">) {
  const blocked = await limited()
  if (blocked) return blocked
  const { slug } = await ctx.params
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return apiError(400, "Invalid slug.")
  const detail = await getAppDetail(slug)
  if (!detail) return apiError(404, "Not found, or not public.")
  const history = await getEvidenceHistory(detail.app.id, 300)
  return json({ apiVersion: API_VERSION, slug: detail.app.slug, data: history.map(evidenceItem) })
}
