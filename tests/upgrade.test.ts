/**
 * Upgrades of a database that already holds data. Two steps are covered:
 *  1. the closed-beta migration on top of the original schema (what production ran on 2026-09-23);
 *  2. every V2 migration on top of that, which is what production will run next.
 * In both cases nothing a user created may be lost or rewritten.
 */
import assert from "node:assert/strict"
import { it } from "node:test"
import { applyMigration, createDb, FIRST_V2_MIGRATION, migrationFiles } from "./helpers/pg"

const CLOSED_BETA = "20260922222344_closed_beta_integrity.sql"
const counts = "select (select count(*) from apps) apps, (select count(*) from reviews) reviews, (select count(*) from ratings) ratings, (select count(*) from favorites) favorites, (select count(*) from app_claims) claims, (select count(*) from profiles) profiles"

it("upgrades the existing seeded schema without losing reviews, ratings or origins", async () => {
  const db = await createDb({ upTo: CLOSED_BETA })
  try {
    const before = (await db.query(counts)).rows[0]
    await db.exec("alter table reviews disable trigger reviews_sync_rating; update reviews set rating=1 where id='50000000-0000-4000-8000-000000000001'; alter table reviews enable trigger reviews_sync_rating;")
    await applyMigration(db, CLOSED_BETA)
    assert.deepEqual((await db.query(counts)).rows[0], before)
    assert.equal((await db.query("select 1 from reviews v join ratings r using(app_id,user_id) where v.rating is distinct from r.rating")).rows.length, 0)
    assert.equal((await db.query<{ n: number }>("select count(*)::int n from apps_public")).rows[0].n, 15)
  } finally { await db.close() }
})

it("V2 migrations keep every id, slug, owner, review, rating and favourite, and only add knowledge", async () => {
  const db = await createDb({ upTo: FIRST_V2_MIGRATION })
  try {
    const snapshot = "select id, slug, developer_id, category, status, ownership_status, url, domain, is_featured from apps order by id"
    const before = (await db.query(counts)).rows[0]
    const appsBefore = (await db.query(snapshot)).rows
    const reviewsBefore = (await db.query("select id, app_id, user_id, rating, body, hidden_at from reviews order by id")).rows

    for (const f of migrationFiles().filter((m) => m >= FIRST_V2_MIGRATION)) await applyMigration(db, f)

    assert.deepEqual((await db.query(counts)).rows[0], before)
    assert.deepEqual((await db.query(snapshot)).rows, appsBefore)
    assert.deepEqual((await db.query("select id, app_id, user_id, rating, body, hidden_at from reviews order by id")).rows, reviewsBefore)
    // v1 reads still work
    assert.equal((await db.query<{ n: number }>("select count(*)::int n from apps_public")).rows[0].n, 15)
    // every listing was mapped to a V2 category and became searchable
    const [m] = (await db.query<{ n: number; cat: number; search: number; primary_rows: number }>(
      "select count(*)::int n, count(primary_category_id)::int cat, count(search_vector)::int search, (select count(*)::int from app_categories where is_primary) primary_rows from apps")).rows
    assert.deepEqual([m.cat, m.search, m.primary_rows], [m.n, m.n, m.n])
    // what v1 had observed became evidence with its original date; nothing else was invented
    const facts = (await db.query<{ attribute_key: string; verified_state: string; vendor_state: string }>(
      "select distinct attribute_key, verified_state, vendor_state from app_facts order by 1")).rows
    assert.deepEqual(facts.map((f) => f.attribute_key), ["https", "pwa_manifest", "website_reachable"])
    assert.ok(facts.every((f) => f.vendor_state === "unknown"), "no vendor statement is invented")
    const [trust] = (await db.query<{ unknown_dpa: number }>(
      "select count(*)::int unknown_dpa from app_facts where attribute_key in ('dpa_available','eu_hosting_available','privacy_policy')")).rows
    assert.equal(trust.unknown_dpa, 0, "unknown trust facts have no row at all: they are not turned into a no")
    const [dates] = (await db.query<{ same: boolean }>(
      "select bool_and(e.collected_at = c.last_checked_at) same from app_evidence e join app_checks c on c.app_id = e.app_id")).rows
    assert.equal(dates.same, true)
  } finally { await db.close() }
})
