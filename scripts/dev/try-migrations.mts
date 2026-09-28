// Scratch check (not shipped in CI): replay migrations + seed on PGlite and print what V2 computed.
import { createDb } from "../../tests/helpers/pg"

async function main() {
  const db = await createDb({ seed: true })
  const q = async (sql: string) => (await db.query(sql)).rows
  console.log("apps", await q("select count(*)::int n, count(primary_category_id)::int with_cat, count(search_vector)::int with_search from public.apps"))
  console.log("states", await q("select verification_state, count(*)::int n, min(evidence_score) mn, max(evidence_score) mx, min(profile_completeness) pmin, max(profile_completeness) pmax from public.apps group by 1"))
  console.log("facts", await q("select attribute_key, effective_state, effective_source, count(*)::int n from public.app_facts group by 1,2,3 order by 1,2"))
  console.log("catalog", await q("select count(*)::int n from public.catalog_apps"))
  console.log("search metro", await q("select c.slug, round(s.score::numeric,2) score, s.total from public.search_catalog('metro fit', '{\"demo\": true}'::jsonb) s join public.catalog_apps c on c.id = s.app_id limit 3"))
  console.log("search typo", await q("select c.slug, round(s.score::numeric,2) score from public.search_catalog('invoce', '{\"demo\": true}'::jsonb) s join public.catalog_apps c on c.id = s.app_id limit 3"))
  console.log("filter pwa", await q("select count(*)::int n from public.search_catalog(null, '{\"demo\": true, \"facts\": [\"pwa_manifest\"]}'::jsonb)"))
  await db.close()
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
