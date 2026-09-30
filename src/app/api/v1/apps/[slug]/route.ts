import type { NextRequest } from "next/server"
import { getAppDetail, getDuplicateTarget } from "@/lib/data/catalog"
import { siteUrl } from "@/lib/env"
import { API_VERSION, apiError, appSummary, factDetail, json, limited, localeOf, preflight } from "@/lib/v2/api"

export const OPTIONS = preflight

/** GET /api/v1/apps/{slug}?lang= — one listing with every documented fact and both layers (verified, vendor). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/v1/apps/[slug]">) {
  const blocked = await limited()
  if (blocked) return blocked
  const { slug } = await ctx.params
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return apiError(400, "Invalid slug.")
  const locale = localeOf(req.nextUrl.searchParams.get("lang"))
  const detail = await getAppDetail(slug)
  if (!detail) {
    const target = await getDuplicateTarget(slug)
    if (target) return apiError(301, `This listing was merged into "${target}".`, { location: `${siteUrl}/api/v1/apps/${target}` })
    return apiError(404, "Not found, or not public.")
  }
  const { app } = detail
  return json({
    apiVersion: API_VERSION, lang: locale,
    data: {
      ...appSummary(app, locale),
      description: (locale === "de" && app.descriptionDe) || app.description,
      descriptionLanguage: locale === "de" && app.descriptionDe ? "de" : app.contentLocale,
      facts: detail.facts.filter((f) => f.effectiveState !== "unknown" || f.lastAttemptAt).map(factDetail),
      pricingPlans: detail.pricingPlans.map((p) => ({ name: p.name, interval: p.billingInterval, price: p.priceCents === null ? null : { amount: p.priceCents / 100, currency: p.currency }, perUser: p.perUser, origin: p.sourceType, source: p.sourceUrl })),
      dataLocations: detail.dataLocations.map((d) => ({ region: d.region, country: d.countryCode, default: d.isDefault, origin: d.sourceType, source: d.sourceUrl })),
      subprocessors: detail.subprocessors.map((d) => ({ name: d.name, purpose: d.purpose, country: d.countryCode, origin: d.sourceType, source: d.sourceUrl })),
      aiProviders: detail.aiProviders.map((d) => ({ provider: d.provider, model: d.modelName, purpose: d.purpose, origin: d.sourceType, source: d.sourceUrl })),
      alternativeTo: detail.alternativeTo.map((a) => ({ name: a.name, slug: a.appSlug })),
      evidenceUrl: `${siteUrl}/api/v1/apps/${app.slug}/evidence`,
    },
  })
}
