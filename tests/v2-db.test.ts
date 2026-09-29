/**
 * V2 rules checked against the real migrations on an in-process Postgres:
 * evidence vs statements, append-only history, unknown vs no, buyer privacy, launches, moderation.
 */
import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import type { PGlite } from "@electric-sql/pglite"
import { createDb, ids, session } from "./helpers/pg"

let db: PGlite
let q: ReturnType<typeof session>["q"]
let as: ReturnType<typeof session>["as"]
const moderator = ids.rater3

before(async () => {
  db = await createDb()
  ;({ q, as } = session(db))
  await q(`update public.profiles set role = 'moderator' where id = '${moderator}'`)
})
after(async () => { await db.close() })

const fact = async (appId: string, key: string) =>
  (await q<{ verified_state: string; vendor_state: string; effective_state: string; effective_source: string; verified_at: string | null; last_attempt_outcome: string | null; verified_value: string | null; vendor_value: string | null }>(
    `select verified_state, vendor_state, effective_state, effective_source, verified_at, last_attempt_outcome, verified_value, vendor_value from public.app_facts where app_id = '${appId}' and attribute_key = '${key}'`))[0]
const observe = (appId: string, results: unknown[]) =>
  as("service", async () => (await q<{ id: string }>(
    `select public.record_verification_run('${appId}', (select url from public.apps where id = '${appId}'), 'automatic', null, '${JSON.stringify(results).replace(/'/g, "''")}'::jsonb) id`))[0].id)

describe("unknown is not no", () => {
  it("a listing nobody checked has no answer, and no filter treats that as a no or a yes", async () => {
    assert.equal(await fact(ids.invoicelite, "dpa_available"), undefined)
    const [c] = await q<{ facts: Record<string, unknown>; facts_yes: string[] }>(`select facts, facts_yes from public.catalog_apps where id = '${ids.invoicelite}'`)
    assert.equal("dpa_available" in c.facts, false)
    assert.equal(c.facts_yes.includes("dpa_available"), false)
    assert.equal((await q(`select 1 from public.search_catalog(null, '{"demo": true, "facts": ["dpa_available"]}'::jsonb)`)).length, 0)
  })
})

describe("statements and evidence stay separate", () => {
  it("a verified owner's claim is stored as vendor_stated whatever the client sends", async () => {
    await as(ids.novalabs, () => q(`insert into public.app_evidence (app_id, attribute_key, value_state, source_type, verification_method, source_url, verified_at, confidence)
      values ('${ids.metroFit}', 'dpa_available', 'yes', 'pwanova_observed', 'automatic', 'https://metro-fit.example/dpa', now(), 100)`))
    const [e] = await q<{ source_type: string; verification_method: string; status: string; verified_at: string | null; submitted_by: string }>(
      `select source_type, verification_method, status, verified_at, submitted_by from public.app_evidence where app_id = '${ids.metroFit}' and attribute_key = 'dpa_available'`)
    assert.deepEqual(e, { source_type: "vendor_stated", verification_method: "vendor", status: "current", verified_at: null, submitted_by: ids.novalabs })
    const f = await fact(ids.metroFit, "dpa_available")
    assert.deepEqual([f.verified_state, f.vendor_state, f.effective_state, f.effective_source], ["unknown", "yes", "yes", "vendor"])
  })

  it("the same words from somebody who has not proven ownership wait for review and change nothing", async () => {
    await as(ids.oak, () => q(`insert into public.app_evidence (app_id, attribute_key, value_state, source_type, verification_method, source_url)
      values ('${ids.mealcraft}', 'eu_hosting_available', 'yes', 'vendor_stated', 'vendor', 'https://mealcraft.example/hosting')`))
    const [e] = await q<{ source_type: string; status: string }>(`select source_type, status from public.app_evidence where app_id = '${ids.mealcraft}' and attribute_key = 'eu_hosting_available'`)
    assert.deepEqual(e, { source_type: "user_submitted", status: "pending_review" })
    assert.equal(await fact(ids.mealcraft, "eu_hosting_available").then((f) => f?.effective_state ?? "unknown"), "unknown")
    await as("anon", async () => assert.equal((await q(`select 1 from public.app_evidence where app_id = '${ids.mealcraft}' and attribute_key = 'eu_hosting_available'`)).length, 0))
  })

  it("what PWANova verified cannot be overwritten by the maker: a later statement sits next to it", async () => {
    await observe(ids.metroFit, [{ check_key: "privacy", attribute_key: "privacy_policy", outcome: "found", value_state: "yes", value_text: "https://metro-fit.example/privacy", source_url: "https://metro-fit.example/privacy", source_title: "Privacy" }])
    await as(ids.novalabs, () => q(`insert into public.app_evidence (app_id, attribute_key, value_state, source_type, verification_method) values ('${ids.metroFit}', 'privacy_policy', 'no', 'vendor_stated', 'vendor')`))
    const f = await fact(ids.metroFit, "privacy_policy")
    assert.deepEqual([f.verified_state, f.vendor_state, f.effective_state, f.effective_source], ["yes", "no", "yes", "verified"])
  })

  it("evidence is append-only: nobody edits what was said, the maker cannot touch an observation", async () => {
    const [obs] = await q<{ id: string }>(`select id from public.app_evidence where app_id = '${ids.metroFit}' and attribute_key = 'privacy_policy' and source_type = 'pwanova_observed'`)
    await as(ids.novalabs, async () => {
      await q(`update public.app_evidence set status = 'retracted' where id = '${obs.id}'`) // RLS: not the maker's row, zero rows
      await q(`delete from public.app_evidence where id = '${obs.id}'`).catch(() => undefined)
    })
    assert.equal((await q<{ status: string }>(`select status from public.app_evidence where id = '${obs.id}'`))[0].status, "current")
    await as(moderator, () => assert.rejects(q(`update public.app_evidence set value_state = 'no' where id = '${obs.id}'`), /append-only/))
    await as("service", () => assert.rejects(q(`update public.app_evidence set source_url = 'https://evil.example' where id = '${obs.id}'`), /append-only/))
  })

  it("a maker may retract their own statement, which removes it from the current facts", async () => {
    await as(ids.novalabs, () => q(`update public.app_evidence set status = 'retracted' where app_id = '${ids.metroFit}' and attribute_key = 'privacy_policy' and source_type = 'vendor_stated'`))
    const f = await fact(ids.metroFit, "privacy_policy")
    assert.deepEqual([f.verified_state, f.vendor_state], ["yes", "unknown"])
  })

  it("the computed trust columns on the listing are not the maker's to set", async () => {
    await as(ids.novalabs, () => q(`update public.apps set verification_state = 'evidence_verified', evidence_score = 100, profile_completeness = 100, tagline = 'Team fitness, tracked together.' where id = '${ids.metroFit}'`))
    const [a] = await q<{ verification_state: string; evidence_score: number; profile_completeness: number; tagline: string }>(`select verification_state, evidence_score, profile_completeness, tagline from public.apps where id = '${ids.metroFit}'`)
    assert.equal(a.tagline, "Team fitness, tracked together.")
    assert.notEqual(a.evidence_score, 100)
    assert.notEqual(a.profile_completeness, 100)
    assert.equal(a.verification_state, "partially_verified")
  })

  it("recording a run is reserved for the service role", async () => {
    const call = `select public.record_verification_run('${ids.metroFit}', 'https://x.example', 'automatic', null, '[]'::jsonb)`
    await as(ids.novalabs, () => assert.rejects(q(call), /permission denied/))
    await as("anon", () => assert.rejects(q(call), /permission denied/))
    await as(ids.novalabs, () => assert.rejects(q(`select public.observe_fact('${ids.metroFit}', 'https', 'yes', null, 'https://x.example', 'x')`), /permission denied/))
  })
})

describe("verification history", () => {
  it("a check that could not run changes nothing: the earlier answer and its date stay", async () => {
    const before = await fact(ids.metroFit, "privacy_policy")
    await observe(ids.metroFit, [{ check_key: "privacy", attribute_key: "privacy_policy", outcome: "could_not_check", detail: { reason: "HTTP 403" } }])
    const after = await fact(ids.metroFit, "privacy_policy")
    assert.deepEqual([after.verified_state, String(after.verified_at)], [before.verified_state, String(before.verified_at)])
    assert.equal(after.last_attempt_outcome, "could_not_check")
    const [run] = await q<{ status: string }>(`select status from public.verification_runs where app_id = '${ids.metroFit}' order by started_at desc, created_at desc limit 1`)
    assert.equal(run.status, "failed")
  })

  it("seeing the same thing again confirms the row instead of rewriting history", async () => {
    const same = { check_key: "privacy", attribute_key: "privacy_policy", outcome: "found", value_state: "yes", value_text: "https://metro-fit.example/privacy", source_url: "https://metro-fit.example/privacy", source_title: "Privacy" }
    await observe(ids.metroFit, [same])
    const rows = await q<{ confirmations: number; status: string; last_confirmed_at: string | null }>(`select confirmations, status, last_confirmed_at from public.app_evidence where app_id = '${ids.metroFit}' and attribute_key = 'privacy_policy' and source_type = 'pwanova_observed'`)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].confirmations, 2)
    assert.ok(rows[0].last_confirmed_at)
  })

  it("a different observation is appended and the old one is kept as superseded", async () => {
    await observe(ids.metroFit, [{ check_key: "privacy", attribute_key: "privacy_policy", outcome: "found", value_state: "yes", value_text: "https://metro-fit.example/legal/privacy", source_url: "https://metro-fit.example/legal/privacy", source_title: "Privacy policy" }])
    const rows = await q<{ status: string; source_url: string }>(`select status, source_url from public.app_evidence where app_id = '${ids.metroFit}' and attribute_key = 'privacy_policy' and source_type = 'pwanova_observed' order by collected_at`)
    assert.deepEqual(rows.map((r) => r.status), ["superseded", "current"])
    await as("anon", async () => assert.equal((await q(`select 1 from public.app_evidence where app_id = '${ids.metroFit}' and attribute_key = 'privacy_policy' and source_type = 'pwanova_observed'`)).length, 2, "history is public"))
  })

  it("a negative result of an automatic search for a document never becomes a no", async () => {
    await observe(ids.invoicelite, [{ check_key: "dpa", attribute_key: "dpa_available", outcome: "not_found", value_state: "unknown" }])
    const f = await fact(ids.invoicelite, "dpa_available")
    assert.equal(f.effective_state, "unknown")
    assert.equal(f.last_attempt_outcome, "not_found")
  })
})

describe("companies and countries", () => {
  it("the EU is the EU: Germany yes, Switzerland and Norway no", async () => {
    const [r] = await q<{ de: boolean; ch: boolean; no: boolean; eea_no: boolean }>(`select public.is_eu_country('DE') de, public.is_eu_country('CH') ch, public.is_eu_country('NO') no, public.is_eea_country('NO') eea_no`)
    assert.deepEqual(r, { de: true, ch: false, no: false, eea_no: true })
  })

  it("a company described by the verified owner becomes a vendor statement with a derived EU fact", async () => {
    await as(ids.novalabs, async () => {
      const [c] = await q<{ id: string; source_type: string; verified_at: string | null }>(`insert into public.companies (slug, name, country_code, source_type, verified_at) values ('nova-labs', 'Nova Labs GmbH', 'DE', 'admin_reviewed', now()) returning id, source_type, verified_at`)
      assert.deepEqual([c.source_type, c.verified_at], ["vendor_stated", null])
      await q(`update public.apps set company_id = '${c.id}' where id = '${ids.metroFit}'`)
    })
    const country = await fact(ids.metroFit, "company_country")
    const eu = await fact(ids.metroFit, "eu_company")
    assert.deepEqual([country.vendor_state, country.vendor_value, country.verified_state], ["yes", "DE", "unknown"])
    assert.deepEqual([eu.vendor_state, eu.verified_state, eu.effective_source], ["yes", "unknown", "vendor"])
    const [c] = await q<{ company_country: string; company_in_eu: boolean }>(`select company_country, company_in_eu from public.catalog_apps where id = '${ids.metroFit}'`)
    assert.deepEqual(c, { company_country: "DE", company_in_eu: true })
  })

  it("a Swiss company is a company outside the EU, not an unknown", async () => {
    await as(ids.marina, async () => {
      const [c] = await q<{ id: string }>(`insert into public.companies (slug, name, country_code) values ('alpen-soft', 'Alpen Soft AG', 'CH') returning id`)
      await q(`update public.apps set company_id = '${c.id}' where id = '${ids.invoicelite}'`)
    })
    assert.equal((await fact(ids.invoicelite, "eu_company")).vendor_state, "no")
  })
})

describe("maker-controlled facts", () => {
  it("rows are stamped with their real origin and observed rows are out of the maker's reach", async () => {
    await as(ids.novalabs, async () => {
      await q(`insert into public.app_languages (app_id, language_code, source_type, verified_at) values ('${ids.metroFit}', 'de', 'admin_reviewed', now())`)
      await q(`update public.app_platforms set source_type = 'vendor_stated' where app_id = '${ids.metroFit}' and platform = 'web'`)
      await q(`delete from public.app_platforms where app_id = '${ids.metroFit}' and platform = 'web'`)
      await assert.rejects(q(`insert into public.app_languages (app_id, language_code) values ('${ids.invoicelite}', 'de')`), /row-level security/)
    })
    assert.deepEqual((await q(`select source_type, verified_at from public.app_languages where app_id = '${ids.metroFit}'`))[0], { source_type: "vendor_stated", verified_at: null })
    assert.equal((await q<{ source_type: string }>(`select source_type from public.app_platforms where app_id = '${ids.metroFit}' and platform = 'web'`))[0].source_type, "pwanova_observed")
  })
})

describe("follows and notifications", () => {
  it("publishing an update notifies followers, only them, and they can only mark it read", async () => {
    await as(ids.rater1, () => q(`insert into public.follows (user_id, app_id) values ('${ids.rater1}', '${ids.metroFit}')`))
    await as(ids.rater1, () => assert.rejects(q(`insert into public.follows (user_id, app_id) values ('${ids.rater2}', '${ids.metroFit}')`), /row-level security/))
    await as(ids.novalabs, () => q(`insert into public.app_updates (app_id, title, body, kind) values ('${ids.metroFit}', 'Offline mode for workouts', 'Log a workout without a connection.', 'feature')`))
    await as(ids.rater2, () => assert.rejects(q(`insert into public.app_updates (app_id, title) values ('${ids.metroFit}', 'Not my app')`), /row-level security/))
    await as(ids.rater1, async () => {
      const rows = await q<{ id: string; kind: string; title: string }>(`select id, kind, title from public.notifications`)
      assert.deepEqual(rows.map((r) => [r.kind, r.title]), [["app_update", "Offline mode for workouts"]])
      await q(`update public.notifications set read_at = now(), title = 'changed', link = '/admin' where id = '${rows[0].id}'`)
      const [n] = await q<{ title: string; link: string; read_at: string | null }>(`select title, link, read_at from public.notifications where id = '${rows[0].id}'`)
      assert.equal(n.title, "Offline mode for workouts")
      assert.equal(n.link, "/apps/metro-fit#updates")
      assert.ok(n.read_at)
      await assert.rejects(q(`insert into public.notifications (user_id, kind) values ('${ids.rater1}', 'system')`), /permission denied/)
    })
    await as(ids.rater2, async () => assert.equal((await q(`select 1 from public.notifications`)).length, 0))
  })
})

describe("comparisons", () => {
  it("hold at most four apps and belong to one person", async () => {
    const apps = (await q<{ id: string }>(`select id from public.apps where status = 'published' order by slug limit 5`)).map((r) => r.id)
    await as(ids.rater1, async () => {
      const [c] = await q<{ id: string }>(`insert into public.comparisons (user_id, slug_key) values ('${ids.rater1}', 'a-vs-b') returning id`)
      for (let i = 0; i < 4; i++) await q(`insert into public.comparison_apps (comparison_id, app_id, position) values ('${c.id}', '${apps[i]}', ${i + 1})`)
      await assert.rejects(q(`insert into public.comparison_apps (comparison_id, app_id, position) values ('${c.id}', '${apps[4]}', 5)`), /check/)
      await assert.rejects(q(`insert into public.comparison_apps (comparison_id, app_id, position) values ('${c.id}', '${apps[4]}', 4)`), /duplicate key/)
    })
    await as(ids.rater2, async () => assert.equal((await q(`select 1 from public.comparisons`)).length, 0))
    await as("anon", async () => assert.equal((await q(`select 1 from public.comparison_apps`)).length, 0))
  })
})

describe("launches", () => {
  it("a maker submits, a moderator approves, the window is thirty days and only one launch runs at a time", async () => {
    await as(ids.novalabs, async () => {
      await q(`insert into public.launches (app_id, slug, headline, status, is_sponsored, window_start, window_end) values ('${ids.metroFit}', 'metro-fit-teams', 'Team challenges are here', 'approved', true, now(), now() + interval '300 days')`)
      await q(`update public.launches set status = 'approved' where slug = 'metro-fit-teams'`)
      await assert.rejects(q(`insert into public.launches (app_id, slug, headline) values ('${ids.metroFit}', 'metro-fit-again', 'A second launch')`), /already has a launch/)
      await assert.rejects(q(`insert into public.launches (app_id, slug, headline) values ('${ids.invoicelite}', 'not-mine', 'Somebody else''s app')`), /row-level security/)
    })
    const [l] = await q<{ status: string; is_sponsored: boolean; window_start: string | null }>(`select status, is_sponsored, window_start from public.launches where slug = 'metro-fit-teams'`)
    assert.deepEqual(l, { status: "pending", is_sponsored: false, window_start: null })
    await as("anon", async () => assert.equal((await q(`select 1 from public.launch_board`)).length, 0))
    await as(ids.rater1, () => assert.rejects(q(`select public.decide_launch((select id from public.launches where slug = 'metro-fit-teams'), 'approve')`), /Moderator required/))
    await as(moderator, () => q(`select public.decide_launch((select id from public.launches where slug = 'metro-fit-teams'), 'approve', 'Looks good')`))
    const [b] = await q<{ days: number; in_window: boolean; launch_score: number }>(`select round(extract(epoch from (window_end - window_start)) / 86400)::int days, in_window, launch_score from public.launch_board where slug = 'metro-fit-teams'`)
    assert.equal(b.days, 30)
    assert.equal(b.in_window, true)
    assert.ok(b.launch_score > 0)
  })

  it("ranking counts distinct signed-in people, not repeated actions", async () => {
    const score = async () => (await q<{ visitors: number; follows: number }>(`select visitors, follows from public.launch_board where slug = 'metro-fit-teams'`))[0]
    const before = await score()
    await as("service", async () => {
      for (let i = 0; i < 5; i++) await q(`insert into public.app_events (app_id, user_id, event_type) values ('${ids.metroFit}', '${ids.rater2}', 'launch_view')`)
      for (let i = 0; i < 5; i++) await q(`insert into public.app_events (app_id, user_id, event_type) values ('${ids.metroFit}', null, 'launch_view')`)
    })
    const after = await score()
    assert.equal(Number(after.visitors) - Number(before.visitors), 1)
  })
})

describe("buyer requests", () => {
  let requestId = ""
  let responseId = ""
  it("requirements can be private; contact details are readable by the buyer and nobody else", async () => {
    await as(ids.rater1, async () => {
      const [r] = await q<{ id: string; status: string }>(`insert into public.buyer_requests (user_id, title, problem, country_code, languages, required_facts, visibility, status)
        values ('${ids.rater2}', 'Team fitness tracker for 20 people', 'We need a shared training plan with German language support and EU data hosting.', 'DE', '{de}', '{eu_hosting_available,dpa_available}', 'private', 'matched') returning id, status`)
      requestId = r.id
      assert.equal(r.status, "open")
      await q(`insert into public.buyer_request_contacts (request_id, user_id, contact_name, contact_email, company_name) values ('${requestId}', '${ids.rater1}', 'Jana Beispiel', 'jana@example.org', 'Beispiel GmbH')`)
    })
    assert.equal((await q<{ user_id: string }>(`select user_id from public.buyer_requests where id = '${requestId}'`))[0].user_id, ids.rater1)
    for (const who of ["anon", ids.rater2, ids.novalabs, moderator] as const) {
      await as(who, async () => {
        if (who === "anon") await assert.rejects(q(`select 1 from public.buyer_request_contacts`), /permission denied/)
        else assert.equal((await q(`select 1 from public.buyer_request_contacts`)).length, 0, `contacts visible to ${who}`)
      })
    }
    await as("anon", async () => assert.equal((await q(`select 1 from public.buyer_requests where id = '${requestId}'`)).length, 0))
    await as(ids.rater2, async () => assert.equal((await q(`select 1 from public.buyer_requests where id = '${requestId}'`)).length, 0))
  })

  it("a matched, verified vendor sees the requirements, never the person", async () => {
    await as(ids.novalabs, async () => assert.equal((await q(`select 1 from public.buyer_requests where id = '${requestId}'`)).length, 0, "not matched yet"))
    await as("service", () => q(`insert into public.buyer_request_matches (request_id, app_id, rank, score, reasons) values ('${requestId}', '${ids.metroFit}', 1, 0.8, '{"matched": ["languages"]}'), ('${requestId}', '${ids.mealcraft}', 2, 0.4, '{}')`))
    await as(ids.novalabs, async () => {
      assert.equal((await q(`select 1 from public.buyer_requests where id = '${requestId}'`)).length, 1)
      await assert.rejects(q(`insert into public.buyer_request_matches (request_id, app_id, rank, score) values ('${requestId}', '${ids.metroFit}', 1, 9)`), /permission denied/)
      const [r] = await q<{ id: string; status: string }>(`insert into public.buyer_request_responses (request_id, app_id, vendor_user_id, message, status) values ('${requestId}', '${ids.metroFit}', '${ids.novalabs}', 'We support German and host in Frankfurt.', 'contact_shared') returning id, status`)
      responseId = r.id
      assert.equal(r.status, "interested")
      assert.equal((await q<{ c: unknown }>(`select public.shared_contact('${responseId}') c`))[0].c, null)
      assert.equal((await q(`select 1 from public.buyer_request_contacts`)).length, 0)
    })
    // matched, but ownership not verified: no access and no way to respond
    await as(ids.oak, async () => {
      assert.equal((await q(`select 1 from public.buyer_requests where id = '${requestId}'`)).length, 0)
      await assert.rejects(q(`insert into public.buyer_request_responses (request_id, app_id, vendor_user_id) values ('${requestId}', '${ids.mealcraft}', '${ids.oak}')`), /row-level security/)
    })
  })

  it("contact details move only by the buyer's recorded consent, field by field, and consent can be withdrawn", async () => {
    await as(ids.novalabs, () => assert.rejects(q(`select public.share_contact('${responseId}', '{contact_email}', 'x')`), /Not your request/))
    await as(ids.novalabs, () => assert.rejects(q(`insert into public.buyer_contact_consents (request_id, response_id, granted_by, shared_fields, consent_text) values ('${requestId}', '${responseId}', '${ids.novalabs}', '{contact_email}', 'x')`), /permission denied/))
    await as(ids.rater1, () => q(`select public.share_contact('${responseId}', '{contact_email,company_name}', 'Share my e-mail address and company name with Metro Fit.')`))
    await as(ids.novalabs, async () => {
      const [r] = await q<{ c: Record<string, string> }>(`select public.shared_contact('${responseId}') c`)
      assert.deepEqual(Object.keys(r.c).sort(), ["company_name", "contact_email", "granted_at"])
      assert.equal(r.c.contact_email, "jana@example.org")
      assert.equal((await q(`select 1 from public.notifications where kind = 'contact_shared'`)).length, 1)
    })
    await as(ids.marina, () => assert.rejects(q(`select public.shared_contact('${responseId}')`), /Not your response/))
    const [k] = await q<{ consent_text: string; granted_by: string }>(`select consent_text, granted_by from public.buyer_contact_consents where response_id = '${responseId}'`)
    assert.deepEqual(k, { consent_text: "Share my e-mail address and company name with Metro Fit.", granted_by: ids.rater1 })
    await as(ids.rater1, () => q(`select public.revoke_contact('${responseId}')`))
    await as(ids.novalabs, async () => assert.equal((await q<{ c: unknown }>(`select public.shared_contact('${responseId}') c`))[0].c, null))
  })

  it("a public request shows requirements to everybody and still no contact data", async () => {
    await as(ids.rater2, async () => {
      const [r] = await q<{ id: string }>(`insert into public.buyer_requests (user_id, title, problem, visibility) values ('${ids.rater2}', 'Invoice tool with DATEV export', 'Small agency, five people, needs DATEV export and German invoices.', 'public') returning id`)
      await q(`insert into public.buyer_request_contacts (request_id, user_id, contact_email) values ('${r.id}', '${ids.rater2}', 'office@example.org')`)
    })
    await as("anon", async () => {
      assert.equal((await q(`select 1 from public.buyer_requests where visibility = 'public'`)).length, 1)
      await assert.rejects(q(`select contact_email from public.buyer_request_contacts`), /permission denied/)
    })
  })
})

describe("moderation and audit", () => {
  it("moderator tools need the role and a reason, and every change leaves previous and new values", async () => {
    const call = `select public.admin_set_fact('${ids.invoicelite}', 'dpa_available', 'yes', 'https://invoicelite.example/dpa.pdf', 'https://invoicelite.example/dpa.pdf', 'DPA (PDF)', 'Data Processing Agreement, version 3', 'Read the published PDF')`
    await as(ids.marina, () => assert.rejects(q(call), /Moderator required/))
    await as(moderator, () => assert.rejects(q(call.replace("'Read the published PDF'", "''")), /reason is required/))
    await as(moderator, () => q(call))
    const f = await fact(ids.invoicelite, "dpa_available")
    assert.deepEqual([f.verified_state, f.effective_source], ["yes", "verified"])
    const [log] = await q<{ actor_id: string; actor_role: string; previous: { verified_state: string }; next: { verified_state: string }; reason: string }>(
      `select actor_id, actor_role, previous, next, reason from public.audit_logs where action = 'fact.set' order by created_at desc limit 1`)
    assert.deepEqual([log.actor_id, log.actor_role, log.previous.verified_state, log.next.verified_state, log.reason], [moderator, "moderator", "unknown", "yes", "Read the published PDF"])
    await as(moderator, async () => assert.equal((await q(`select 1 from public.audit_logs`)).length, 0, "the audit trail is for admins"))
    await as(moderator, () => assert.rejects(q(`insert into public.audit_logs (action, target_type) values ('x', 'y')`), /permission denied/))
  })

  it("a user submission becomes evidence only when a moderator has checked the source", async () => {
    const [e] = await q<{ id: string }>(`select id from public.app_evidence where app_id = '${ids.mealcraft}' and attribute_key = 'eu_hosting_available' and status = 'pending_review'`)
    await as(ids.oak, () => assert.rejects(q(`select public.review_evidence('${e.id}', 'approve', 'Trust me')`), /Moderator required/))
    await as(moderator, () => q(`select public.review_evidence('${e.id}', 'approve', 'Hosting page names Frankfurt as the default region')`))
    const f = await fact(ids.mealcraft, "eu_hosting_available")
    assert.deepEqual([f.verified_state, f.vendor_state, f.effective_source], ["yes", "unknown", "verified"])
    const rows = await q<{ source_type: string; status: string }>(`select source_type, status from public.app_evidence where app_id = '${ids.mealcraft}' and attribute_key = 'eu_hosting_available' order by created_at`)
    assert.deepEqual(rows, [{ source_type: "user_submitted", status: "superseded" }, { source_type: "admin_reviewed", status: "current" }])
  })

  it("review states stay in step with v1's hidden_at, in both directions", async () => {
    const [r] = await q<{ id: string }>(`select id from public.reviews where app_id = '${ids.invoicelite}' and hidden_at is null limit 1`)
    await as(moderator, () => q(`update public.reviews set status = 'hidden', moderation_reason = 'Advertising' where id = '${r.id}'`))
    assert.ok((await q<{ hidden_at: string | null }>(`select hidden_at from public.reviews where id = '${r.id}'`))[0].hidden_at)
    await as("anon", async () => assert.equal((await q(`select 1 from public.reviews where id = '${r.id}'`)).length, 0))
    await as(moderator, () => q(`update public.reviews set status = 'published' where id = '${r.id}'`))
    assert.equal((await q<{ hidden_at: string | null }>(`select hidden_at from public.reviews where id = '${r.id}'`))[0].hidden_at, null)
    await as(moderator, () => q(`select public.moderate('remove_review', '${r.id}', 'Advertising again')`))
    assert.equal((await q<{ status: string }>(`select status from public.reviews where id = '${r.id}'`))[0].status, "hidden")
    await as(ids.rater1, () => q(`update public.reviews set status = 'published' where id = '${r.id}'`))
    assert.equal((await q<{ status: string }>(`select status from public.reviews where id = '${r.id}'`))[0].status, "hidden")
  })

  it("merging a duplicate is an admin decision that moves saves and takes the duplicate out of the catalogue", async () => {
    await q(`update public.profiles set role = 'admin' where id = '${ids.marina}'`)
    const [dup] = await q<{ id: string }>(`insert into public.apps (developer_id, name, slug, tagline, url, domain, status) values (null, 'Metro Fit Copy', 'metro-fit-copy', 'Same product, second listing', 'https://copy.metro-fit.example/', 'copy.metro-fit.example', 'published') returning id`)
    await as(ids.rater2, () => q(`insert into public.favorites (app_id, user_id) values ('${dup.id}', '${ids.rater2}')`))
    await as(moderator, () => assert.rejects(q(`select public.merge_duplicate_app('${dup.id}', '${ids.metroFit}', 'Same product')`), /Admin required/))
    await as(ids.marina, () => q(`select public.merge_duplicate_app('${dup.id}', '${ids.metroFit}', 'Same product, same company')`))
    assert.equal((await q(`select 1 from public.favorites where app_id = '${ids.metroFit}' and user_id = '${ids.rater2}'`)).length, 1)
    assert.equal((await q(`select 1 from public.catalog_apps where id = '${dup.id}'`)).length, 0)
    assert.equal((await q<{ duplicate_of: string }>(`select duplicate_of from public.apps where id = '${dup.id}'`))[0].duplicate_of, ids.metroFit)
    await q(`update public.profiles set role = 'developer' where id = '${ids.marina}'`)
  })

  it("ownership can be revoked, and the former owner's statements stop counting as vendor statements", async () => {
    await q(`update public.profiles set role = 'admin' where id = '${ids.marina}'`)
    await as(ids.marina, () => q(`select public.revoke_ownership('${ids.metroFit}', 'Claim file was placed by a contractor without authority')`))
    const [a] = await q<{ developer_id: string | null; ownership_status: string }>(`select developer_id, ownership_status from public.apps where id = '${ids.metroFit}'`)
    assert.deepEqual(a, { developer_id: null, ownership_status: "unclaimed" })
    assert.equal((await fact(ids.metroFit, "dpa_available")).vendor_state, "unknown")
    assert.equal((await fact(ids.metroFit, "privacy_policy")).verified_state, "yes", "what PWANova observed is unaffected")
    // the company the former owner described is no longer shown: nobody accountable stands behind it
    const [c] = await q<{ company_name: string | null; company_in_eu: boolean | null }>(`select company_name, company_in_eu from public.catalog_apps where id = '${ids.metroFit}'`)
    assert.deepEqual(c, { company_name: null, company_in_eu: null })
    await q(`update public.profiles set role = 'developer' where id = '${ids.marina}'`)
  })
})

describe("plans and settings", () => {
  it("nothing is paywalled until monetisation is enforced; then a plan is required and an admin grants it", async () => {
    const enabled = () => as(ids.novalabs, async () => (await q<{ ok: boolean }>(`select public.feature_enabled('buyer_requests.respond') ok`))[0].ok)
    assert.equal(await enabled(), true)
    await q(`update public.site_settings set value = '{"enforced": true}' where key = 'monetization'`)
    assert.equal(await enabled(), false)
    await as(ids.novalabs, () => assert.rejects(q(`insert into public.entitlements (user_id, plan_slug) values ('${ids.novalabs}', 'vendor-pro')`), /permission denied/))
    await as(ids.novalabs, () => assert.rejects(q(`select public.grant_entitlement('novalabs', 'vendor-pro', null, null, 'self service')`), /Admin required/))
    await q(`update public.profiles set role = 'admin' where id = '${ids.marina}'`)
    await as(ids.marina, () => q(`select public.grant_entitlement((select username from public.profiles where id = '${ids.novalabs}'), 'vendor-pro', null, now() + interval '30 days', 'Beta partner')`))
    assert.equal(await enabled(), true)
    await q(`update public.site_settings set value = '{"enforced": false}' where key = 'monetization'`)
    await q(`update public.profiles set role = 'developer' where id = '${ids.marina}'`)
  })

  it("prices live in the database and paid plans are announced, not orderable", async () => {
    const plans = await q<{ slug: string; price_cents: number; is_available: boolean }>(`select slug, price_cents, is_available from public.plans order by sort_order`)
    assert.deepEqual(plans.map((p) => [p.slug, p.price_cents]), [["basic", 0], ["verified", 4900], ["launch-pro", 9900], ["maker-pro", 2900], ["vendor-pro", 14900], ["category-sponsor", 19900], ["newsletter-sponsor", 29900]])
    assert.deepEqual(plans.filter((p) => p.is_available).map((p) => p.slug), ["basic"])
  })

  it("public settings are readable, internal ones and the newsletter list are not", async () => {
    await as("anon", async () => {
      assert.deepEqual((await q<{ key: string }>(`select key from public.site_settings order by key`)).map((r) => r.key), ["features", "monetization", "operator"])
      await assert.rejects(q(`insert into public.newsletter_subscriptions (email, consent_source, consent_text) values ('a@example.org', 'footer', 'yes')`), /permission denied/)
      assert.equal((await q(`select 1 from public.newsletter_subscriptions`)).length, 0)
    })
  })
})

describe("search", () => {
  const search = async (query: string | null, filters: Record<string, unknown> = {}, sort = "relevance") =>
    (await q<{ slug: string }>(`select c.slug from public.search_catalog(${query === null ? "null" : `'${query.replace(/'/g, "''")}'`}, '${JSON.stringify({ demo: true, ...filters })}'::jsonb, '${sort}') s join public.catalog_apps c on c.id = s.app_id order by s.score desc, c.slug`)).map((r) => r.slug)

  it("finds an exact name first and forgives a typo", async () => {
    assert.equal((await search("invoicelite"))[0], "invoicelite")
    assert.ok((await search("invoce lite")).includes("invoicelite"))
    assert.ok((await search("metro fti")).includes("metro-fit"))
  })
  it("finds by what the product is for, in English and in German", async () => {
    const [cat] = await q<{ slug: string }>(`select c.slug from public.categories c join public.apps a on a.primary_category_id = c.id where a.id = '${ids.invoicelite}'`)
    assert.equal(cat.slug, "finance")
    assert.ok((await search("finance")).includes("invoicelite"))
    assert.ok((await search("Finanzen")).includes("invoicelite"))
  })
  it("filters by category, by trust facts, and by both together", async () => {
    const finance = await search(null, { categories: ["finance"] })
    assert.ok(finance.includes("invoicelite") && !finance.includes("metro-fit"))
    assert.deepEqual(await search(null, { facts: ["dpa_available"] }), ["invoicelite"])
    assert.deepEqual(await search(null, { facts: ["dpa_available"], categories: ["health-fitness"] }), [])
    assert.deepEqual(await search(null, { facts: ["dpa_available", "eu_hosting_available"] }), [])
    // metro-fit lost its verified owner above, and with it the company that owner had described
    assert.deepEqual(await search(null, { eu_company: true }), [])
    const budgetly = "40000000-0000-4000-8000-000000000009" // another listing of the same, still verified, owner
    await as(ids.novalabs, () => q(`update public.apps set company_id = (select id from public.companies where slug = 'nova-labs') where id = '${budgetly}'`))
    assert.deepEqual(await search(null, { eu_company: true }), ["budgetly"])
    assert.deepEqual(await search(null, { countries: ["CH"] }), ["invoicelite"])
  })
  it("verified-only ignores vendor statements", async () => {
    await as("service", () => q(`insert into public.app_evidence (app_id, attribute_key, value_state, source_type, verification_method) values ('${ids.invoicelite}', 'open_source', 'yes', 'vendor_stated', 'vendor')`))
    assert.deepEqual(await search(null, { facts: ["open_source"] }), ["invoicelite"])
    assert.deepEqual(await search(null, { facts: ["open_source"], verified_only: true }), [])
  })
  it("keeps fabricated demo listings out unless they are asked for", async () => {
    assert.equal((await q(`select 1 from public.search_catalog(null, '{}'::jsonb)`)).length, 0)
    assert.ok((await q(`select 1 from public.search_catalog(null, '{"demo": true}'::jsonb)`)).length >= 15)
  })
  it("caps page size and tolerates hostile input", async () => {
    assert.ok((await q(`select 1 from public.search_catalog('%'' or 1=1 --', '{"demo": true}'::jsonb, 'relevance', 100000, -5)`)).length <= 100)
    assert.equal((await q(`select 1 from public.search_catalog(repeat('a', 5000), '{"demo": true}'::jsonb)`)).length, 0)
  })
})
