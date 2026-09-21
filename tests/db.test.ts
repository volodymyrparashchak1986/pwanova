/**
 * Runs the real migrations + seed on an in-process Postgres (PGlite) and checks RLS and business rules.
 * Supabase-managed pieces (auth schema, roles) are stubbed in tests/supabase-prelude.sql.
 */
import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { after, before, describe, it } from "node:test"
import { PGlite } from "@electric-sql/pglite"

const root = new URL("../", import.meta.url)
const read = (p: string) => readFileSync(new URL(p, root), "utf8")

let db: PGlite
const ids = {
  novalabs: "20000000-0000-4000-8000-000000000001", // owns metro-fit (verified_owner)
  marina: "20000000-0000-4000-8000-000000000003", // owns invoicelite (verified) and studyspace
  oak: "20000000-0000-4000-8000-000000000005", // owns mealcraft (claim_pending)
  rater1: "10000000-0000-4000-8000-000000000060", // not a reviewer of metro-fit
  rater2: "10000000-0000-4000-8000-000000000061",
  metroFit: "40000000-0000-4000-8000-000000000001",
  mealcraft: "40000000-0000-4000-8000-000000000004",
  invoicelite: "40000000-0000-4000-8000-000000000003",
  metroReview: "50000000-0000-4000-8000-000000000001", // by demo user 0 on metro-fit
  mealReview: "50000000-0000-4000-8000-000000000031",
}

/** Run SQL as an authenticated user / anon / service, the way PostgREST would. */
async function as<T>(who: string | "anon" | "service", fn: () => Promise<T>): Promise<T> {
  const role = who === "anon" ? "anon" : who === "service" ? "service_role" : "authenticated"
  await db.exec(`select set_config('request.jwt.claim.sub', '${who === "anon" || who === "service" ? "" : who}', false); select set_config('request.jwt.claim.role', '${role}', false); set role ${role};`)
  try { return await fn() } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claim.role', '', false);") }
}
const q = async <T = Record<string, unknown>>(sql: string) => (await db.query<T>(sql)).rows

before(async () => {
  db = new PGlite()
  await db.exec(read("tests/supabase-prelude.sql"))
  for (const f of readdirSync(new URL("supabase/migrations/", root)).sort()) await db.exec(read(`supabase/migrations/${f}`))
  await db.exec(read("supabase/seed.sql"))
})
after(async () => { await db.close() })

describe("schema + seed", () => {
  it("seeds 15 demo apps, all flagged demo", async () => {
    const [r] = await q<{ n: number; demo: number }>("select count(*)::int n, count(*) filter (where is_demo)::int demo from public.apps")
    assert.deepEqual(r, { n: 15, demo: 15 })
  })
  it("seeds only demo reviews", async () => {
    const [r] = await q<{ n: number }>("select count(*)::int n from public.reviews where not is_demo")
    assert.equal(r.n, 0)
  })
})

describe("public reads", () => {
  it("anon reads published apps, ratings, reviews, checks", async () => {
    await as("anon", async () => {
      assert.ok((await q("select 1 from public.apps_public limit 1")).length)
      assert.ok((await q("select 1 from public.ratings limit 1")).length)
      assert.ok((await q("select 1 from public.reviews limit 1")).length)
      assert.ok((await q("select 1 from public.app_checks limit 1")).length)
    })
  })
  it("anon cannot read raw events, favorites, claims or reports", async () => {
    await as("anon", async () => {
      for (const t of ["app_events", "favorites", "app_claims", "reports", "rate_limits"]) assert.equal((await q(`select 1 from public.${t} limit 1`)).length, 0, t)
    })
  })
  it("hidden apps disappear from public reads", async () => {
    await q("update public.apps set status = 'hidden' where slug = 'taskpilot'")
    await as("anon", async () => {
      assert.equal((await q("select 1 from public.apps where slug = 'taskpilot'")).length, 0)
      assert.equal((await q("select 1 from public.apps_public where slug = 'taskpilot'")).length, 0)
    })
    await q("update public.apps set status = 'published' where slug = 'taskpilot'")
  })
})

describe("ratings", () => {
  it("one rating per user per app; changing is an update", async () => {
    await as(ids.rater1, async () => {
      await q(`insert into public.ratings (app_id, user_id, rating) values ('${ids.metroFit}', '${ids.rater1}', 5)`)
      await assert.rejects(q(`insert into public.ratings (app_id, user_id, rating) values ('${ids.metroFit}', '${ids.rater1}', 4)`), /duplicate key/)
      await q(`update public.ratings set rating = 3 where app_id = '${ids.metroFit}' and user_id = '${ids.rater1}'`)
      const [r] = await q<{ rating: number }>(`select rating from public.ratings where app_id = '${ids.metroFit}' and user_id = '${ids.rater1}'`)
      assert.equal(r.rating, 3)
    })
  })
  it("rejects out-of-range values and impersonation", async () => {
    await as(ids.rater2, async () => {
      await assert.rejects(q(`insert into public.ratings (app_id, user_id, rating) values ('${ids.metroFit}', '${ids.rater2}', 6)`), /check/)
      await assert.rejects(q(`insert into public.ratings (app_id, user_id, rating) values ('${ids.metroFit}', '${ids.rater1}', 1)`), /row-level security/)
    })
  })
  it("users cannot edit someone else's rating", async () => {
    await as(ids.rater2, async () => {
      await q(`update public.ratings set rating = 1 where user_id = '${ids.rater1}' and app_id = '${ids.metroFit}'`)
    })
    const [r] = await q<{ rating: number }>(`select rating from public.ratings where app_id = '${ids.metroFit}' and user_id = '${ids.rater1}'`)
    assert.equal(r.rating, 3)
  })
})

describe("reviews", () => {
  it("user creates, edits and deletes only their own review; rating stays in sync", async () => {
    await as(ids.rater2, async () => {
      await q(`insert into public.reviews (app_id, user_id, rating, body) values ('${ids.metroFit}', '${ids.rater2}', 4, 'Solid app, works offline too.')`)
      await q(`update public.reviews set rating = 2, body = 'Changed my mind about it.' where user_id = '${ids.rater2}' and app_id = '${ids.metroFit}'`)
      const [r] = await q<{ rating: number }>(`select rating from public.ratings where user_id = '${ids.rater2}' and app_id = '${ids.metroFit}'`)
      assert.equal(r.rating, 2, "rating follows review")
    })
  })
  it("cannot write a review as someone else or edit/delete another user's review", async () => {
    await as(ids.rater2, async () => {
      await assert.rejects(q(`insert into public.reviews (app_id, user_id, rating, body) values ('${ids.mealcraft}', '${ids.rater1}', 5, 'fake fake fake')`), /row-level security/)
      await q(`update public.reviews set body = 'hijacked' where id = '${ids.metroReview}'`)
      await q(`delete from public.reviews where id = '${ids.metroReview}'`)
    })
    const [r] = await q<{ body: string }>(`select body from public.reviews where id = '${ids.metroReview}'`)
    assert.notEqual(r.body, "hijacked")
  })
  it("clients cannot forge trust flags", async () => {
    await as(ids.rater1, async () => {
      await q(`insert into public.reviews (app_id, user_id, rating, body, verified_user, verified_usage, helpful_count) values ('${ids.mealcraft}', '${ids.rater1}', 4, 'Nice meal planner overall.', true, true, 99)`)
    })
    const [r] = await q<{ verified_user: boolean; verified_usage: boolean; helpful_count: number }>(`select verified_user, verified_usage, helpful_count from public.reviews where user_id = '${ids.rater1}' and app_id = '${ids.mealcraft}'`)
    assert.deepEqual(r, { verified_user: false, verified_usage: false, helpful_count: 0 })
  })
  it("helpful votes: one per user, counted, not on own review", async () => {
    await as(ids.rater1, async () => {
      const before = (await q<{ h: number }>(`select helpful_count h from public.reviews where id = '${ids.metroReview}'`))[0].h
      await q(`insert into public.review_helpful (review_id, user_id) values ('${ids.metroReview}', '${ids.rater1}')`)
      await assert.rejects(q(`insert into public.review_helpful (review_id, user_id) values ('${ids.metroReview}', '${ids.rater1}')`), /duplicate key/)
      const after = (await q<{ h: number }>(`select helpful_count h from public.reviews where id = '${ids.metroReview}'`))[0].h
      assert.equal(after, before + 1)
      const own = (await q<{ id: string }>(`select id from public.reviews where user_id = '${ids.rater1}' limit 1`))[0].id
      await assert.rejects(q(`insert into public.review_helpful (review_id, user_id) values ('${own}', '${ids.rater1}')`), /own review/)
    })
  })
})

describe("developer responses", () => {
  it("verified owner can respond to reviews of their own app", async () => {
    await q(`delete from public.developer_responses where review_id = '${ids.metroReview}'`)
    await as(ids.novalabs, async () => {
      await q(`insert into public.developer_responses (review_id, developer_id, body) values ('${ids.metroReview}', '${ids.novalabs}', 'Thanks!')`)
    })
  })
  it("another developer cannot respond on an app they don't own", async () => {
    await q(`delete from public.developer_responses where review_id = '${ids.metroReview}'`)
    await as(ids.marina, async () => {
      await assert.rejects(q(`insert into public.developer_responses (review_id, developer_id, body) values ('${ids.metroReview}', '${ids.marina}', 'I am not the owner')`), /row-level security/)
    })
  })
  it("a claim_pending (unverified) submitter cannot respond", async () => {
    await as(ids.oak, async () => {
      await assert.rejects(q(`insert into public.developer_responses (review_id, developer_id, body) values ('${ids.mealReview}', '${ids.oak}', 'Unverified owner reply')`), /row-level security/)
    })
  })
  it("cannot respond as another developer id", async () => {
    await as(ids.marina, async () => {
      await assert.rejects(q(`insert into public.developer_responses (review_id, developer_id, body) values ('${ids.metroReview}', '${ids.novalabs}', 'spoof')`), /row-level security/)
    })
  })
})

describe("favorites", () => {
  it("users manage only their own favorites and cannot read others'", async () => {
    await as(ids.rater1, async () => {
      await q(`insert into public.favorites (app_id, user_id) values ('${ids.mealcraft}', '${ids.rater1}')`)
      await assert.rejects(q(`insert into public.favorites (app_id, user_id) values ('${ids.mealcraft}', '${ids.rater1}')`), /duplicate key/)
      await assert.rejects(q(`insert into public.favorites (app_id, user_id) values ('${ids.mealcraft}', '${ids.rater2}')`), /row-level security/)
      const seen = await q<{ user_id: string }>("select user_id from public.favorites")
      assert.ok(seen.every((r) => r.user_id === ids.rater1))
      await q(`delete from public.favorites where app_id = '${ids.mealcraft}' and user_id = '${ids.rater1}'`)
    })
  })
})

describe("app ownership & protected columns", () => {
  it("developers cannot self-verify, self-feature or take over ownership", async () => {
    await as(ids.oak, async () => {
      await q(`update public.apps set verification_status = 'verified', ownership_status = 'verified_owner', is_featured = true, is_pwa = true, developer_id = '${ids.rater1}', name = 'Renamed' where id = '${ids.mealcraft}'`)
    })
    const [a] = await q<Record<string, unknown>>(`select name, verification_status, ownership_status, is_featured, is_pwa, developer_id from public.apps where id = '${ids.mealcraft}'`)
    assert.equal(a.name, "Renamed", "editable fields still work")
    assert.equal(a.verification_status, "unverified")
    assert.equal(a.ownership_status, "claim_pending")
    assert.equal(a.is_featured, false)
    assert.equal(a.is_pwa, true, "seed value untouched (was true)")
    assert.equal(a.developer_id, ids.oak)
  })
  it("new submissions start claim_pending/unverified regardless of what the client sends", async () => {
    await as(ids.rater1, async () => {
      await q(`insert into public.apps (developer_id, name, slug, url, domain, ownership_status, verification_status, is_featured, is_pwa, status) values ('${ids.rater1}', 'Sneaky', 'sneaky', 'https://sneaky.example', 'sneaky.example', 'verified_owner', 'verified', true, true, 'published')`)
    })
    const [a] = await q<Record<string, unknown>>("select ownership_status, verification_status, is_featured, is_pwa from public.apps where slug = 'sneaky'")
    assert.deepEqual(a, { ownership_status: "claim_pending", verification_status: "unverified", is_featured: false, is_pwa: false })
  })
  it("cannot create an app for someone else", async () => {
    await as(ids.rater2, async () => {
      await assert.rejects(q(`insert into public.apps (developer_id, name, slug, url, domain) values ('${ids.rater1}', 'X', 'xx', 'https://xx.example', 'xx.example')`), /row-level security/)
    })
  })
  it("owners cannot un-suspend their app", async () => {
    await q("update public.apps set status = 'suspended' where slug = 'sneaky'")
    await as(ids.rater1, async () => { await q("update public.apps set status = 'published' where slug = 'sneaky'") })
    assert.equal((await q<{ status: string }>("select status from public.apps where slug = 'sneaky'"))[0].status, "suspended")
  })
  it("users cannot promote themselves to admin or grant themselves the verified badge", async () => {
    await as(ids.rater1, async () => { await q(`update public.profiles set role = 'admin', is_verified = true, bio = 'hi' where id = '${ids.rater1}'`) })
    const [p] = await q<{ role: string; is_verified: boolean; bio: string }>(`select role, is_verified, bio from public.profiles where id = '${ids.rater1}'`)
    assert.deepEqual(p, { role: "user", is_verified: false, bio: "hi" })
  })
})

describe("events, moderation, admin", () => {
  it("clients cannot write events (server-only ingestion)", async () => {
    await as(ids.rater1, async () => {
      await assert.rejects(q(`insert into public.app_events (app_id, event_type) values ('${ids.metroFit}', 'open_app')`), /row-level security/)
    })
  })
  it("developers can read events for their own apps only", async () => {
    await as(ids.novalabs, async () => {
      const mine = (await q<{ id: string }>(`select id from public.apps where developer_id = '${ids.novalabs}'`)).map((r) => r.id)
      const rows = await q<{ app_id: string }>("select distinct app_id from public.app_events")
      assert.ok(rows.length > 0 && rows.every((r) => mine.includes(r.app_id)))
      const foreign = await q(`select 1 from public.app_events where app_id = '${ids.invoicelite}' limit 1`)
      assert.equal(foreign.length, 0)
    })
  })
  it("users file reports and read only their own; only admins can act on them", async () => {
    await as(ids.rater1, async () => {
      await q(`insert into public.reports (user_id, review_id, reason) values ('${ids.rater1}', '${ids.metroReview}', 'spam')`)
      assert.equal((await q("select 1 from public.reports")).length, 1)
      await q("update public.reports set status = 'resolved'")
    })
    assert.equal((await q<{ status: string }>("select status from public.reports"))[0].status, "open")
  })
  it("admin can remove a review, hide, verify and feature apps; regular users cannot", async () => {
    await q(`update public.profiles set role = 'admin' where id = '${ids.marina}'`)
    await as(ids.marina, async () => {
      await q(`update public.apps set is_featured = true, verification_status = 'verified' where id = '${ids.mealcraft}'`)
      await q(`delete from public.reviews where id = '${ids.mealReview}'`)
    })
    assert.equal((await q<{ f: boolean }>(`select is_featured f from public.apps where id = '${ids.mealcraft}'`))[0].f, true)
    assert.equal((await q(`select 1 from public.reviews where id = '${ids.mealReview}'`)).length, 0)
    await q(`update public.profiles set role = 'developer' where id = '${ids.marina}'`)
  })
  it("rate limit function is not callable by clients", async () => {
    await as(ids.rater1, async () => {
      await assert.rejects(q("select public.check_rate_limit('k', 1, 60)"), /permission denied/)
    })
    await as("service", async () => {
      assert.equal((await q<{ ok: boolean }>("select public.check_rate_limit('k', 1, 60) ok"))[0].ok, true)
      assert.equal((await q<{ ok: boolean }>("select public.check_rate_limit('k', 1, 60) ok"))[0].ok, false)
    })
  })
})

describe("developer dashboard", () => {
  it("returns analytics for the caller's apps only", async () => {
    await as(ids.novalabs, async () => {
      const [{ d }] = await q<{ d: { totals: Record<string, number>; series: unknown[]; trafficSources: { source: string }[]; topApps: { slug: string }[] } }>("select public.developer_dashboard(14) d")
      assert.equal(d.series.length, 14)
      assert.ok(d.totals.views > 0 && d.totals.opens > 0)
      assert.ok(d.trafficSources.length > 0)
      assert.deepEqual(d.topApps.map((a) => a.slug).sort(), ["budgetly", "metro-fit", "teampulse"])
    })
    await as(ids.rater2, async () => {
      const [{ d }] = await q<{ d: { totals: Record<string, number> } }>("select public.developer_dashboard(14) d")
      assert.equal(d.totals.views, 0)
    })
  })
})

describe("ranking", () => {
  it("SQL ranking_score matches the TypeScript mirror", async () => {
    const { rankingScore } = await import("../src/lib/ranking")
    for (const c of [[4.9, 52, 3, 40, 1200, 300, 6], [5, 1, 1, 0, 60, 10, 5], [3.2, 200, 40, 90, 20, 1, 2], [0, 0, 0, 0, 0, 0, 0]] as const) {
      const [row] = await q<{ s: string }>(`select public.ranking_score(${c[0]}, ${c[1]}, ${c[2]}, ${c[3]}, ${c[4]}, ${c[5]}, ${c[6]}) s`)
      const ts = rankingScore({ rating: c[0], ratingsCount: c[1], reviewsCount: c[2], favoritesCount: c[3], opens30d: c[4], opens7d: c[5], qualityPassed: c[6] })
      assert.ok(Math.abs(Number(row.s) - ts) < 0.01, `${c.join(",")}: sql ${row.s} vs ts ${ts}`)
    }
  })
  it("a single 5.0 rating does not win #1", async () => {
    const rows = await q<{ slug: string; ratings_count: number; rating: string; ranking_score: string }>("select slug, ratings_count, rating, ranking_score from public.apps_public order by ranking_score desc")
    assert.notEqual(rows[0].slug, "taskpilot")
    const tp = rows.find((r) => r.slug === "taskpilot")!
    assert.equal(tp.ratings_count, 1)
    assert.ok(rows.findIndex((r) => r.slug === "taskpilot") > 5)
  })
  it("rating breakdown sums to the total", async () => {
    const rows = await q<{ stars: number; total: string }>(`select * from public.rating_breakdown('${ids.metroFit}')`)
    const total = rows.reduce((s, r) => s + Number(r.total), 0)
    const [{ n }] = await q<{ n: number }>(`select count(*)::int n from public.ratings where app_id = '${ids.metroFit}'`)
    assert.equal(total, n)
  })
})
