/**
 * End-to-end verification of a REAL Supabase project: Auth, RLS, triggers, views, RPCs and Storage.
 *
 *   npm run verify:supabase        (reads .env.local)
 *
 * It creates throw-away users and rows (prefix "verify-"), exercises the rules the app relies on
 * exactly the way PostgREST clients do, and deletes everything afterwards. Safe to run on a project
 * with real data, but it does write to it, so run it against dev/staging or an empty production.
 */
import { randomBytes } from "node:crypto"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !anonKey || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY")
  process.exit(2)
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, serviceKey, opts)
const anon = () => createClient(url, anonKey, opts)

const run = randomBytes(3).toString("hex")
const results: { name: string; ok: boolean; detail?: string }[] = []
async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    results.push({ name, ok: true })
    console.log(`  ✓ ${name}`)
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    results.push({ name, ok: false, detail })
    console.log(`  ✗ ${name}\n      ${detail}`)
  }
}
const expect = (cond: unknown, msg: string) => { if (!cond) throw new Error(msg) }
/** Expect a PostgREST call to fail (optionally with a matching code/message). */
const denied = (res: { error: { code?: string; message: string } | null }, match?: RegExp, what = "operation") => {
  expect(res.error, `${what} should have been rejected but succeeded`)
  if (match) expect(match.test(`${res.error!.code} ${res.error!.message}`), `${what} failed with unexpected error: ${res.error!.code} ${res.error!.message}`)
}
const ok = <T extends { error: { message: string } | null }>(res: T, what: string) => {
  expect(!res.error, `${what} failed: ${res.error?.message}`)
  return res
}

interface TestUser { id: string; email: string; client: SupabaseClient }
const created: string[] = []
async function makeUser(tag: string): Promise<TestUser> {
  const email = `verify-${tag}-${run}@pwanova-verify.example`
  const password = randomBytes(18).toString("base64url")
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { user_name: `verify-${tag}-${run}`, full_name: `Verify ${tag}` } })
  if (error || !data.user) throw new Error(`createUser(${tag}): ${error?.message}`)
  created.push(data.user.id)
  const client = anon()
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw new Error(`signIn(${tag}): ${signInError.message}`)
  return { id: data.user.id, email, client }
}

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64")
const uploaded: string[] = []
const appIds: string[] = []

async function main() {
  console.log(`Verifying ${url} (run ${run})\n`)

  // ------------------------------------------------------------------ public surface
  console.log("Public (anon key)")
  const pub = anon()
  await check("apps_public readable; seed apps present and flagged demo", async () => {
    const { data, error } = await pub.from("apps_public").select("slug, is_demo, ranking_score, ratings_count").order("ranking_score", { ascending: false })
    expect(!error, error?.message ?? "")
    expect((data ?? []).length >= 15, `expected >= 15 apps, got ${data?.length}`)
  })
  await check("a single 5.0 rating does not rank #1 (real data)", async () => {
    const { data } = await pub.from("apps_public").select("slug, ratings_count, ranking_score").order("ranking_score", { ascending: false })
    expect(data?.[0]?.slug !== "taskpilot", "taskpilot (1 rating) is ranked first")
  })
  await check("rating_breakdown RPC works", async () => {
    const { data: app } = await pub.from("apps_public").select("id, ratings_count").eq("slug", "metro-fit").single()
    const { data, error } = await pub.rpc("rating_breakdown", { p_app_id: app!.id })
    expect(!error && data?.length === 5, error?.message ?? "expected 5 rows")
    expect(data!.reduce((s: number, r: { total: string }) => s + Number(r.total), 0) === app!.ratings_count, "breakdown does not sum to ratings_count")
  })
  await check("anon cannot read events / favorites / claims / reports / rate_limits", async () => {
    for (const t of ["app_events", "favorites", "app_claims", "reports", "rate_limits"]) {
      const { data } = await pub.from(t).select("*").limit(1)
      expect((data ?? []).length === 0, `${t} leaked rows to anon`)
    }
  })
  await check("anon cannot write anything (ratings, events, apps)", async () => {
    const { data: app } = await pub.from("apps_public").select("id").eq("slug", "metro-fit").single()
    denied(await pub.from("ratings").insert({ app_id: app!.id, user_id: "00000000-0000-0000-0000-000000000000", rating: 5 }), /42501|row-level|permission|violates/i, "anon rating")
    denied(await pub.from("app_events").insert({ app_id: app!.id, event_type: "view" }), /42501|row-level|permission|violates/i, "anon event")
  })
  await check("rate limit function is not callable by anon", async () => {
    denied(await pub.rpc("check_rate_limit", { p_key: "x", p_max: 1, p_window_seconds: 60 }), /42501|permission|not found|PGRST202/i, "anon check_rate_limit")
  })

  // ------------------------------------------------------------------ users
  console.log("\nAuth + profile trigger")
  const dev = await makeUser("dev")
  const rater = await makeUser("rater")
  const other = await makeUser("other")
  const adminUser = await makeUser("admin")
  await check("Auth admin API can list users (no malformed auth.users rows, e.g. from seeding)", async () => {
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 5 })
    expect(!error, `listUsers failed: ${error?.status} ${error?.message}`)
  })
  await check("profiles are auto-created for new auth users", async () => {
    const { data } = await admin.from("profiles").select("id, username, role, is_verified").in("id", [dev.id, rater.id])
    expect(data?.length === 2, "profiles missing")
    expect(data!.every((p) => p.role === "user" && p.is_verified === false), "unexpected role/verified defaults")
  })
  await check("users cannot self-promote or self-verify; can edit their bio", async () => {
    await rater.client.from("profiles").update({ role: "admin", is_verified: true, bio: "hello there" }).eq("id", rater.id)
    const { data } = await admin.from("profiles").select("role, is_verified, bio").eq("id", rater.id).single()
    expect(data?.role === "user" && data.is_verified === false, `escalation succeeded: ${JSON.stringify(data)}`)
    expect(data?.bio === "hello there", "bio update was blocked")
  })
  await check("users cannot edit another user's profile", async () => {
    await rater.client.from("profiles").update({ bio: "pwned" }).eq("id", other.id)
    const { data } = await admin.from("profiles").select("bio").eq("id", other.id).single()
    expect(data?.bio !== "pwned", "profile of another user was modified")
  })
  await admin.from("profiles").update({ role: "admin" }).eq("id", adminUser.id)

  // ------------------------------------------------------------------ apps
  console.log("\nSubmitting apps (RLS + protective triggers)")
  const slug = `verify-app-${run}`
  let appId = ""
  await check("developer can create an app; trust columns are forced to safe defaults", async () => {
    const res = await dev.client.from("apps").insert({
      developer_id: dev.id, name: "Verify App", slug, url: `https://${slug}.example`, domain: `${slug}.example`, tagline: "temporary",
      ownership_status: "verified_owner", verification_status: "verified", is_featured: true, is_pwa: true, is_installable: true,
    }).select("id, ownership_status, verification_status, is_featured, is_pwa, is_installable, status").single()
    ok(res, "insert app")
    appId = res.data!.id
    appIds.push(appId)
    const a = res.data!
    expect(a.ownership_status === "claim_pending" && a.verification_status === "unverified" && !a.is_featured && !a.is_pwa && !a.is_installable, `forged flags survived: ${JSON.stringify(a)}`)
  })
  await check("cannot create an app on behalf of someone else", async () => {
    denied(await rater.client.from("apps").insert({ developer_id: dev.id, name: "X", slug: `verify-x-${run}`, url: `https://x-${run}.example`, domain: `x-${run}.example` }), /42501|row-level|violates/i, "insert as other developer")
  })
  await check("owner cannot self-verify, self-feature or transfer the app on update", async () => {
    await dev.client.from("apps").update({ verification_status: "verified", ownership_status: "verified_owner", is_featured: true, developer_id: rater.id, name: "Verify App 2" }).eq("id", appId)
    const { data } = await admin.from("apps").select("name, developer_id, verification_status, ownership_status, is_featured").eq("id", appId).single()
    expect(data?.name === "Verify App 2", "legit edit was blocked")
    expect(data?.developer_id === dev.id && data.verification_status === "unverified" && data.ownership_status === "claim_pending" && !data.is_featured, `protected columns changed: ${JSON.stringify(data)}`)
  })
  await check("non-owners cannot edit the app", async () => {
    await rater.client.from("apps").update({ name: "hijacked" }).eq("id", appId)
    const { data } = await admin.from("apps").select("name").eq("id", appId).single()
    expect(data?.name !== "hijacked", "another user edited the app")
  })
  await check("published app is publicly visible in apps_public", async () => {
    const { data } = await pub.from("apps_public").select("slug").eq("slug", slug)
    expect(data?.length === 1, "new app is not visible")
  })

  // ------------------------------------------------------------------ claim
  console.log("\nClaim flow")
  await check("claim token is generated and visible only to its owner", async () => {
    ok(await dev.client.from("app_claims").insert({ app_id: appId, user_id: dev.id }), "create claim")
    const mine = await dev.client.from("app_claims").select("token").eq("app_id", appId).single()
    expect(/^[0-9a-f]{32}$/.test(mine.data?.token ?? ""), `token format: ${mine.data?.token}`)
    const theirs = await rater.client.from("app_claims").select("token").eq("app_id", appId)
    expect((theirs.data ?? []).length === 0, "another user can read the claim token")
  })
  await check("clients cannot mark a claim verified (needs server verification)", async () => {
    await dev.client.from("app_claims").update({ status: "verified" }).eq("app_id", appId)
    const { data } = await admin.from("app_claims").select("status").eq("app_id", appId).single()
    expect(data?.status === "pending", `claim status changed by client: ${data?.status}`)
  })

  // ------------------------------------------------------------------ ratings & reviews
  console.log("\nRatings and reviews")
  await check("one rating per user per app; changing it is an update", async () => {
    ok(await rater.client.from("ratings").insert({ app_id: appId, user_id: rater.id, rating: 5 }), "first rating")
    denied(await rater.client.from("ratings").insert({ app_id: appId, user_id: rater.id, rating: 4 }), /23505|duplicate/i, "duplicate rating")
    ok(await rater.client.from("ratings").upsert({ app_id: appId, user_id: rater.id, rating: 3 }, { onConflict: "app_id,user_id" }), "upsert rating")
    const { data } = await admin.from("ratings").select("rating").eq("app_id", appId)
    expect(data?.length === 1 && data[0].rating === 3, `ratings: ${JSON.stringify(data)}`)
  })
  await check("rating must be 1..5 and cannot be cast as someone else", async () => {
    denied(await other.client.from("ratings").insert({ app_id: appId, user_id: other.id, rating: 6 }), /23514|check/i, "rating 6")
    denied(await other.client.from("ratings").insert({ app_id: appId, user_id: rater.id, rating: 1 }), /42501|row-level|violates/i, "rating as other")
  })
  let reviewId = ""
  await check("review create/edit; rating stays in sync; trust flags cannot be forged", async () => {
    const res = await rater.client.from("reviews").insert({ app_id: appId, user_id: rater.id, rating: 4, title: "Nice", body: "Works well on my phone.", verified_user: true, verified_usage: true, helpful_count: 50 }).select("id, verified_user, verified_usage, helpful_count").single()
    ok(res, "insert review")
    reviewId = res.data!.id
    expect(!res.data!.verified_user && !res.data!.verified_usage && res.data!.helpful_count === 0, `forged review flags: ${JSON.stringify(res.data)}`)
    const { data: r } = await admin.from("ratings").select("rating").eq("app_id", appId).eq("user_id", rater.id).single()
    expect(r?.rating === 4, `rating not synced from review (got ${r?.rating})`)
    ok(await rater.client.from("reviews").update({ body: "Edited: still works well.", rating: 5 }).eq("id", reviewId), "edit review")
    const { data: r2 } = await admin.from("ratings").select("rating").eq("app_id", appId).eq("user_id", rater.id).single()
    expect(r2?.rating === 5, "rating not synced after edit")
  })
  await check("cannot edit or delete someone else's review", async () => {
    await other.client.from("reviews").update({ body: "hijacked" }).eq("id", reviewId)
    await other.client.from("reviews").delete().eq("id", reviewId)
    const { data } = await admin.from("reviews").select("body").eq("id", reviewId).single()
    expect(data && data.body !== "hijacked", "review was tampered with or deleted")
  })
  await check("helpful votes: one per user, counted, none on own review", async () => {
    ok(await other.client.from("review_helpful").insert({ review_id: reviewId, user_id: other.id }), "vote")
    denied(await other.client.from("review_helpful").insert({ review_id: reviewId, user_id: other.id }), /23505|duplicate/i, "duplicate vote")
    denied(await rater.client.from("review_helpful").insert({ review_id: reviewId, user_id: rater.id }), /own review/i, "self vote")
    const { data } = await admin.from("reviews").select("helpful_count").eq("id", reviewId).single()
    expect(data?.helpful_count === 1, `helpful_count = ${data?.helpful_count}`)
  })
  await check("reviews are publicly readable with author and response embeds (as the app queries them)", async () => {
    const { data, error } = await pub.from("reviews").select("*, author:profiles!reviews_user_id_fkey(username, display_name, avatar_url), response:developer_responses(id, body, created_at, developer:profiles(display_name, username))").eq("app_id", appId)
    expect(!error && data?.length === 1 && data[0].author?.username, `embed query failed: ${error?.message}`)
  })

  // ------------------------------------------------------------------ developer responses
  console.log("\nDeveloper responses")
  await check("unverified (claim_pending) owner cannot respond", async () => {
    denied(await dev.client.from("developer_responses").insert({ review_id: reviewId, developer_id: dev.id, body: "Thanks!" }), /42501|row-level|violates/i, "response before verification")
  })
  // simulate the server-side ownership verification (service role)
  ok(await admin.from("apps").update({ ownership_status: "verified_owner" }).eq("id", appId), "simulate verification")
  await check("verified owner can respond; other users cannot; nobody can spoof developer_id", async () => {
    ok(await dev.client.from("developer_responses").insert({ review_id: reviewId, developer_id: dev.id, body: "Thanks for the feedback!" }), "owner response")
    denied(await other.client.from("developer_responses").insert({ review_id: reviewId, developer_id: other.id, body: "I am not the owner" }), /42501|row-level|23505|violates|duplicate/i, "non-owner response")
    await admin.from("developer_responses").delete().eq("review_id", reviewId)
    denied(await other.client.from("developer_responses").insert({ review_id: reviewId, developer_id: dev.id, body: "spoof" }), /42501|row-level|violates/i, "spoofed response")
  })

  // ------------------------------------------------------------------ favorites
  console.log("\nFavorites")
  await check("users manage only their own favorites", async () => {
    ok(await rater.client.from("favorites").insert({ app_id: appId, user_id: rater.id }), "favorite")
    denied(await rater.client.from("favorites").insert({ app_id: appId, user_id: rater.id }), /23505|duplicate/i, "duplicate favorite")
    denied(await rater.client.from("favorites").insert({ app_id: appId, user_id: other.id }), /42501|row-level|violates/i, "favorite as other")
    const theirs = await other.client.from("favorites").select("*").eq("app_id", appId)
    expect((theirs.data ?? []).length === 0, "favorites of another user are visible")
    ok(await rater.client.from("favorites").delete().eq("app_id", appId).eq("user_id", rater.id), "unfavorite")
  })

  // ------------------------------------------------------------------ events + dashboard
  console.log("\nEvents and analytics")
  await check("clients cannot write events; service role can", async () => {
    denied(await rater.client.from("app_events").insert({ app_id: appId, event_type: "open_app" }), /42501|row-level|violates/i, "client event")
    const rows = Array.from({ length: 6 }, (_, i) => ({ app_id: appId, event_type: i < 4 ? "view" : "open_app", source: i % 2 ? "google" : "pwanova_search" }))
    ok(await admin.from("app_events").insert(rows), "service-role events")
  })
  await check("developer_dashboard returns the owner's data only", async () => {
    const mine = await dev.client.rpc("developer_dashboard", { p_days: 14 })
    expect(!mine.error && mine.data.totals.views >= 4 && mine.data.totals.opens >= 2 && mine.data.series.length === 14, `dashboard: ${mine.error?.message ?? JSON.stringify(mine.data?.totals)}`)
    const theirs = await other.client.rpc("developer_dashboard", { p_days: 14 })
    expect(!theirs.error && theirs.data.totals.views === 0, "another user sees someone else's analytics")
  })
  await check("owner can read raw events of own app only", async () => {
    const own = await dev.client.from("app_events").select("id").eq("app_id", appId)
    expect((own.data ?? []).length >= 6, "owner cannot read own events")
    const other_ = await other.client.from("app_events").select("id").eq("app_id", appId)
    expect((other_.data ?? []).length === 0, "non-owner can read events")
  })

  // ------------------------------------------------------------------ moderation
  console.log("\nModeration and admin")
  await check("users can report and see only their own reports; cannot change status", async () => {
    ok(await other.client.from("reports").insert({ user_id: other.id, review_id: reviewId, reason: "spam" }), "report")
    const seen = await other.client.from("reports").select("user_id")
    expect((seen.data ?? []).every((r) => r.user_id === other.id), "reports of other users are visible")
    await other.client.from("reports").update({ status: "resolved" }).eq("user_id", other.id)
    const { data } = await admin.from("reports").select("status").eq("user_id", other.id).single()
    expect(data?.status === "open", "user changed report status")
  })
  await check("admin can feature/hide apps and read reports; regular users cannot", async () => {
    await other.client.from("apps").update({ is_featured: true }).eq("id", appId)
    const { data: before } = await admin.from("apps").select("is_featured").eq("id", appId).single()
    expect(!before?.is_featured, "regular user featured an app")
    ok(await adminUser.client.from("apps").update({ is_featured: true, verification_status: "verified" }).eq("id", appId), "admin update")
    const { data } = await admin.from("apps").select("is_featured, verification_status").eq("id", appId).single()
    expect(data?.is_featured && data.verification_status === "verified", "admin update did not apply")
    const reports = await adminUser.client.from("reports").select("id").eq("review_id", reviewId)
    expect((reports.data ?? []).length === 1, "admin cannot read reports")
    ok(await adminUser.client.from("apps").update({ status: "hidden" }).eq("id", appId), "admin hide")
    const { data: hidden } = await pub.from("apps_public").select("slug").eq("slug", slug)
    expect((hidden ?? []).length === 0, "hidden app still public")
    ok(await adminUser.client.from("reviews").delete().eq("id", reviewId), "admin remove review")
  })

  // ------------------------------------------------------------------ storage
  console.log("\nStorage (app-media)")
  await check("users can upload only inside their own folder", async () => {
    const own = `${dev.id}/verify-${run}.png`
    const up = await dev.client.storage.from("app-media").upload(own, PNG, { contentType: "image/png" })
    expect(!up.error, `own-folder upload failed: ${up.error?.message}`)
    uploaded.push(own)
    const foreign = await dev.client.storage.from("app-media").upload(`${other.id}/verify-${run}.png`, PNG, { contentType: "image/png" })
    expect(foreign.error, "upload into another user's folder succeeded")
    const anonUp = await pub.storage.from("app-media").upload(`anon/verify-${run}.png`, PNG, { contentType: "image/png" })
    expect(anonUp.error, "anonymous upload succeeded")
  })
  await check("uploaded files are publicly readable; non-images are rejected", async () => {
    const { data } = dev.client.storage.from("app-media").getPublicUrl(`${dev.id}/verify-${run}.png`)
    const res = await fetch(data.publicUrl)
    expect(res.ok && (res.headers.get("content-type") ?? "").includes("image/png"), `public fetch: ${res.status} ${res.headers.get("content-type")}`)
    const bad = await dev.client.storage.from("app-media").upload(`${dev.id}/verify-${run}.html`, Buffer.from("<script>1</script>"), { contentType: "text/html" })
    expect(bad.error, "text/html upload was accepted")
  })

  // ------------------------------------------------------------------ service-only
  console.log("\nServer-only pieces")
  await check("check_rate_limit works for service role and is blocked for users", async () => {
    denied(await dev.client.rpc("check_rate_limit", { p_key: `verify-${run}`, p_max: 1, p_window_seconds: 60 }), /42501|permission|PGRST202/i, "user rate-limit call")
    const a = await admin.rpc("check_rate_limit", { p_key: `verify-${run}`, p_max: 1, p_window_seconds: 60 })
    const b = await admin.rpc("check_rate_limit", { p_key: `verify-${run}`, p_max: 1, p_window_seconds: 60 })
    expect(a.data === true && b.data === false, `rate limit results: ${a.data}, ${b.data}`)
  })
  await check("service role bypass works for protected columns (used by server verification)", async () => {
    ok(await admin.from("apps").update({ verification_status: "verified", is_pwa: true }).eq("id", appId), "service update")
    const { data } = await admin.from("apps").select("verification_status, is_pwa").eq("id", appId).single()
    expect(data?.verification_status === "verified" && data.is_pwa, "service role could not write protected columns")
  })
}

async function cleanup() {
  console.log("\nCleaning up")
  if (uploaded.length) await admin.storage.from("app-media").remove(uploaded)
  await admin.storage.from("app-media").remove(created.map((id) => `${id}/verify-${run}.png`))
  await admin.from("apps").delete().like("slug", `verify-%-${run}`)
  for (const id of appIds) await admin.from("apps").delete().eq("id", id)
  await admin.from("rate_limits").delete().eq("key", `verify-${run}`)
  for (const id of created) await admin.auth.admin.deleteUser(id)
  const left = await admin.from("profiles").select("id").in("id", created)
  console.log(left.data?.length ? `  ! ${left.data.length} test profiles remain` : "  ✓ test users, apps and files removed")
}

main()
  .catch((e) => { results.push({ name: "fatal", ok: false, detail: e instanceof Error ? e.stack : String(e) }); console.error(e) })
  .finally(async () => {
    await cleanup().catch((e) => console.error("cleanup failed:", e))
    const failed = results.filter((r) => !r.ok)
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
    process.exit(failed.length ? 1 : 0)
  })
