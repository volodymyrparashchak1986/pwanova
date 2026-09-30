/**
 * What a submitter entered before proving ownership becomes a vendor statement once they prove it
 * (supabase/migrations/20260929100700_v2_owner_statements.sql). Nobody else's submission is promoted.
 */
import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import type { PGlite } from "@electric-sql/pglite"
import { createDb, ids, session } from "./helpers/pg"

let db: PGlite
let q: ReturnType<typeof session>["q"]
let as: ReturnType<typeof session>["as"]

before(async () => {
  db = await createDb()
  ;({ q, as } = session(db))
})
after(async () => { await db.close() })

const evidence = (key: string) => q<{ source_type: string; status: string; submitted_by: string }>(
  `select source_type, status, submitted_by from public.app_evidence where app_id = '${ids.mealcraft}' and attribute_key = '${key}' order by created_at, source_type`)

describe("statements made before ownership was proven", () => {
  it("wait for review and stay out of the public profile", async () => {
    await as(ids.oak, async () => {
      await q(`insert into public.app_evidence (app_id, attribute_key, value_state, source_url) values ('${ids.mealcraft}', 'dpa_available', 'yes', 'https://mealcraft.example/dpa')`)
      await q(`insert into public.app_languages (app_id, language_code) values ('${ids.mealcraft}', 'de')`)
    })
    await as(ids.rater1, () => q(`insert into public.app_evidence (app_id, attribute_key, value_state, source_url) values ('${ids.mealcraft}', 'open_source', 'yes', 'https://example.org/repo')`))
    assert.deepEqual((await evidence("dpa_available")).map((e) => [e.source_type, e.status]), [["user_submitted", "pending_review"]])
    const [lang] = await q<{ source_type: string }>(`select source_type from public.app_languages where app_id = '${ids.mealcraft}' and language_code = 'de'`)
    assert.equal(lang.source_type, "user_submitted")
    assert.equal((await q(`select 1 from public.app_facts where app_id = '${ids.mealcraft}' and attribute_key = 'dpa_available' and effective_state = 'yes'`)).length, 0)
  })

  it("become the vendor's statements when ownership is verified, as new rows", async () => {
    await as("service", () => q(`update public.apps set ownership_status = 'verified_owner', ownership_verified_at = now(), ownership_method = 'well_known' where id = '${ids.mealcraft}'`))
    const rows = (await evidence("dpa_available")).map((e) => [e.source_type, e.status]).sort()
    assert.deepEqual(rows, [["user_submitted", "superseded"], ["vendor_stated", "current"]])
    const [f] = await q<{ vendor_state: string; verified_state: string; effective_state: string; effective_source: string }>(
      `select vendor_state, verified_state, effective_state, effective_source from public.app_facts where app_id = '${ids.mealcraft}' and attribute_key = 'dpa_available'`)
    assert.deepEqual(f, { vendor_state: "yes", verified_state: "unknown", effective_state: "yes", effective_source: "vendor" })
    const [lang] = await q<{ source_type: string }>(`select source_type from public.app_languages where app_id = '${ids.mealcraft}' and language_code = 'de'`)
    assert.equal(lang.source_type, "vendor_stated")
  })

  it("a statement is never presented as verified by PWANova", async () => {
    const [c] = await q<{ facts_verified_yes: string[]; facts_yes: string[] }>(`select facts_verified_yes, facts_yes from public.catalog_apps where id = '${ids.mealcraft}'`)
    assert.equal(c.facts_yes.includes("dpa_available"), true)
    assert.equal(c.facts_verified_yes.includes("dpa_available"), false)
  })

  it("somebody else's submission is not promoted", async () => {
    assert.deepEqual((await evidence("open_source")).map((e) => [e.source_type, e.status]), [["user_submitted", "pending_review"]])
  })
})

describe("paid capabilities and admin changes are enforced and recorded by the database", () => {
  it("while monetisation is not enforced a verified owner responds to a matched request without a plan", async () => {
    const [request] = await as(ids.rater2, () => q<{ id: string }>(`insert into public.buyer_requests (user_id, title, problem, visibility) values ('${ids.rater2}', 'Meal planning for a family', 'We want to plan meals for a week and share the list.', 'public') returning id`))
    await as(ids.oak, () => q(`insert into public.buyer_request_responses (request_id, app_id, vendor_user_id, message) values ('${request.id}', '${ids.mealcraft}', '${ids.oak}', 'We cover this.')`))
    assert.equal((await q(`select 1 from public.buyer_request_responses where request_id = '${request.id}'`)).length, 1)
  })

  it("once it is enforced, a response without an entitlement is refused whatever client sends it", async () => {
    await q(`update public.site_settings set value = '{"enforced": true}'::jsonb where key = 'monetization'`)
    const [request] = await as(ids.rater2, () => q<{ id: string }>(`insert into public.buyer_requests (user_id, title, problem, visibility) values ('${ids.rater2}', 'Shopping list for two people', 'A simple shared list with offline use would be enough.', 'public') returning id`))
    await assert.rejects(
      as(ids.oak, () => q(`insert into public.buyer_request_responses (request_id, app_id, vendor_user_id) values ('${request.id}', '${ids.mealcraft}', '${ids.oak}')`)),
      /active plan/)
    await q(`update public.site_settings set value = '{"enforced": false}'::jsonb where key = 'monetization'`)
  })

  it("changing a setting or a role leaves an audit entry; operator details are not copied into the log", async () => {
    const before = (await q(`select 1 from public.audit_logs`)).length
    await q(`update public.site_settings set value = jsonb_set(value, '{launches}', 'false') where key = 'features'`)
    await q(`update public.site_settings set value = '{"legal_name": "Example GmbH"}'::jsonb where key = 'operator'`)
    await q(`update public.profiles set role = 'moderator' where id = '${ids.rater1}'`)
    const rows = await q<{ action: string; target_type: string; previous: Record<string, unknown>; next: Record<string, unknown>; reason: string | null }>(
      `select action, target_type, previous, next, reason from public.audit_logs order by created_at, action`)
    assert.equal(rows.length, before + 3)
    const operator = rows.find((r) => r.reason === "operator")
    assert.deepEqual(operator?.next, { redacted: true })
    assert.equal(JSON.stringify(rows).includes("Example GmbH"), false)
    const role = rows.find((r) => r.action === "profile.role" && r.next.role === "moderator")
    assert.deepEqual([role?.previous, role?.next], [{ role: "user" }, { role: "moderator" }])
  })
})

describe("organic order", () => {
  it("the rating share follows the rating: a better rated listing scores higher, all else equal", async () => {
    const rows = await q<{ slug: string; rating: string; ratings_count: number; weighted_rating: string | null; organic_score: number }>(
      `select slug, rating, ratings_count, weighted_rating, organic_score from public.catalog_apps where ratings_count > 0 order by weighted_rating desc`)
    assert.ok(rows.length >= 3)
    assert.ok(new Set(rows.map((r) => r.weighted_rating)).size > 1, "weighted ratings differ between listings")
    for (const r of rows) {
      const expected = (r.ratings_count / (r.ratings_count + 10)) * Number(r.rating) + (10 / (r.ratings_count + 10)) * 3.8
      assert.ok(Math.abs(Number(r.weighted_rating) - expected) < 0.002)
      assert.ok(Number(r.weighted_rating) <= 5)
    }
  })

  it("a listing without ratings gets nothing for ratings, and sorting by rating puts it last", async () => {
    await as("service", () => q(`delete from public.ratings where app_id = '${ids.mealcraft}'`))
    const [m] = await q<{ weighted_rating: string | null }>(`select weighted_rating from public.catalog_apps where id = '${ids.mealcraft}'`)
    assert.equal(m.weighted_rating, null)
    const ranked = await q<{ app_id: string }>(`select app_id from public.search_catalog(null, '{"demo": true}'::jsonb, 'rating', 48, 0)`)
    assert.equal(ranked.at(-1)?.app_id, ids.mealcraft)
  })
})

describe("what was typed without proof of ownership is not public, whichever client asks", () => {
  const count = async (table: string, where: string) => (await q(`select 1 from public.${table} where ${where}`)).length
  let company = ""

  it("the submitter sees their own rows; a visitor and another member do not", async () => {
    // budgetly was submitted by somebody who has not proven ownership
    const [app] = await q<{ id: string; developer_id: string }>(`select id, developer_id from public.apps where status = 'published' and ownership_status <> 'verified_owner' and developer_id is not null and id <> '${ids.mealcraft}' order by slug limit 1`)
    assert.ok(app, "the seed has a published listing whose submitter has not proven ownership")
    await as(app.developer_id, async () => {
      const [c] = await q<{ id: string }>(`insert into public.companies (slug, name, country_code, created_by) values ('unproven-gmbh', 'Unproven GmbH', 'DE', '${app.developer_id}') returning id`)
      company = c.id
      await q(`insert into public.pricing_plans (app_id, name, price_cents, currency, billing_interval) values ('${app.id}', 'Team', 900, 'EUR', 'month')`)
      await q(`insert into public.app_subprocessors (app_id, name, purpose) values ('${app.id}', 'Example Mail Ltd', 'E-mail delivery')`)
      await q(`insert into public.app_data_locations (app_id, region, country_code) values ('${app.id}', 'eu', 'DE')`)
      await q(`insert into public.app_ai_providers (app_id, provider) values ('${app.id}', 'Example AI')`)
      await q(`insert into public.app_platforms (app_id, platform) values ('${app.id}', 'ios')`)
      await q(`insert into public.app_languages (app_id, language_code) values ('${app.id}', 'nl')`)
    })
    const tables: [string, string][] = [
      ["companies", `id = '${company}'`], ["pricing_plans", `app_id = '${app.id}' and name = 'Team'`], ["app_subprocessors", `app_id = '${app.id}' and name = 'Example Mail Ltd'`],
      ["app_data_locations", `app_id = '${app.id}' and country_code = 'DE'`], ["app_ai_providers", `app_id = '${app.id}' and provider = 'Example AI'`],
      ["app_platforms", `app_id = '${app.id}' and platform = 'ios'`], ["app_languages", `app_id = '${app.id}' and language_code = 'nl'`],
    ]
    for (const [table, where] of tables) {
      assert.equal(await as(app.developer_id, () => count(table, where)), 1, `${table}: the author sees the row`)
      assert.equal(await as("anon", () => count(table, where)), 0, `${table}: a visitor does not`)
      assert.equal(await as(ids.rater3, () => count(table, where)), 0, `${table}: another member does not`)
      assert.equal(await as(ids.rater1, () => count(table, where)), 1, `${table}: a moderator does`) // rater1 was made a moderator above
    }
  })

  it("what a verified owner states, and what PWANova observed, stays readable for everybody", async () => {
    await as(ids.novalabs, () => q(`insert into public.app_subprocessors (app_id, name, purpose, source_url) values ('${ids.metroFit}', 'Example Hosting GmbH', 'Hosting', 'https://metro-fit.example/subprocessors')`))
    assert.equal(await as("anon", () => count("app_subprocessors", `app_id = '${ids.metroFit}' and name = 'Example Hosting GmbH' and source_type = 'vendor_stated'`)), 1)
    await q(`insert into public.app_platforms (app_id, platform, source_type) values ('${ids.metroFit}', 'android', 'pwanova_observed') on conflict do nothing`)
    assert.equal(await as("anon", () => count("app_platforms", `app_id = '${ids.metroFit}' and platform = 'android'`)), 1)
  })

  it("a slug that is taken by a company nobody else can see is refused by the database, not overwritten", async () => {
    await assert.rejects(as(ids.rater2, () => q(`insert into public.companies (slug, name, created_by) values ('unproven-gmbh', 'Another Unproven GmbH', '${ids.rater2}')`)), /duplicate key|unique/i)
  })
})

describe("companies in the catalogue", () => {
  it("a company typed by somebody who has not proven ownership is not shown and does not match the EU filter", async () => {
    const tripboard = "40000000-0000-4000-8000-000000000005" // submitted by oak, ownership not verified
    await as(ids.oak, async () => {
      const [c] = await q<{ id: string }>(`insert into public.companies (slug, name, country_code, created_by) values ('oak-ember-test', 'Oak & Ember GmbH', 'DE', '${ids.oak}') returning id`)
      await q(`update public.apps set company_id = '${c.id}' where id = '${tripboard}'`)
    })
    const [row] = await q<{ company_name: string | null; company_country: string | null; company_in_eu: boolean | null }>(
      `select company_name, company_country, company_in_eu from public.catalog_apps where id = '${tripboard}'`)
    assert.deepEqual(row, { company_name: null, company_country: null, company_in_eu: null })
    const eu = await q<{ app_id: string }>(`select app_id from public.search_catalog(null, '{"demo": true, "eu_company": true}'::jsonb, 'relevance', 48, 0)`)
    assert.equal(eu.some((r) => r.app_id === tripboard), false)
  })

  it("the same company is shown as the vendor's statement once ownership is verified", async () => {
    const tripboard = "40000000-0000-4000-8000-000000000005"
    await as("service", () => q(`update public.apps set ownership_status = 'verified_owner', ownership_verified_at = now(), ownership_method = 'well_known' where id = '${tripboard}'`))
    const [row] = await q<{ company_name: string | null; company_country: string | null; company_in_eu: boolean | null; company_source_type: string | null }>(
      `select company_name, company_country, company_in_eu, company_source_type from public.catalog_apps where id = '${tripboard}'`)
    assert.deepEqual(row, { company_name: "Oak & Ember GmbH", company_country: "DE", company_in_eu: true, company_source_type: "vendor_stated" })
    const [f] = await q<{ effective_state: string; effective_source: string }>(`select effective_state, effective_source from public.app_facts where app_id = '${tripboard}' and attribute_key = 'eu_company'`)
    assert.deepEqual(f, { effective_state: "yes", effective_source: "vendor" })
  })
})
