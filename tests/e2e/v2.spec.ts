/**
 * End-to-end journeys against the LOCAL stack (playwright.config.ts refuses any other target).
 * Every fixture is created for this run on .example domains and removed afterwards.
 */
import { test, expect, type BrowserContext, type Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { randomUUID } from "node:crypto"

test.describe.configure({ mode: "serial" })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const run = randomUUID().slice(0, 8)
const password = randomUUID()
const users: Record<string, { id: string; email: string }> = {}
const ORIGIN = "http://localhost:3000"

// two listings: "alpha" is owned and documented, "beta" is unclaimed and says nothing
const alpha = { id: "", slug: `alpha-ledger-${run}`, name: `Alpha Ledger ${run}`, url: `https://alpha-${run}.example/` }
const beta = { id: "", slug: `beta-ledger-${run}`, name: `Beta Ledger ${run}`, url: `https://beta-${run}.example/` }

async function login(context: BrowserContext, who: string) {
  const collected: { name: string; value: string }[] = []
  const client = createServerClient(url, anon, { cookies: { getAll: () => [], setAll: (cookies) => { collected.push(...cookies) } } })
  const { error } = await client.auth.signInWithPassword({ email: users[who].email, password })
  expect(error).toBeNull()
  await context.clearCookies()
  await context.addCookies(collected.map((c) => ({ name: c.name, value: c.value, domain: "localhost", path: "/", sameSite: "Lax" as const, httpOnly: false, secure: false })))
}
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
/** What makes a page wider than the screen: the innermost elements that stick out, outside of scrolling frames. */
const sticksOut = (page: Page) => page.evaluate(() => {
  const w = document.documentElement.clientWidth
  if (document.documentElement.scrollWidth <= w) return []
  const framed = (el: Element) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).overflowX !== "visible" && a.getBoundingClientRect().right <= w + 0.5) return true
    return false
  }
  const over = [...document.body.querySelectorAll("*")].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > w + 0.5 && !framed(el) })
  const found = over.filter((el) => !over.some((o) => o !== el && el.contains(o))).slice(0, 5)
    .map((el) => `<${el.tagName.toLowerCase()} class="${el.getAttribute("class") ?? ""}"> "${(el.textContent ?? "").trim().slice(0, 60)}" ends at ${Math.round(el.getBoundingClientRect().right)}px`)
  return found.length ? found : [`the page is ${document.documentElement.scrollWidth}px wide`]
})

test.beforeAll(async () => {
  for (const role of ["buyer", "reviewer", "owner", "submitter", "admin"]) {
    const email = `v2-${role}-${run}@example.com`
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { user_name: `${role}-${run}` } })
    expect(error).toBeNull()
    users[role] = { id: data.user!.id, email }
  }
  await admin.from("profiles").update({ role: "admin" }).eq("id", users.admin.id)

  const base = { category: "finance", status: "published", tagline: "Invoices and bookkeeping for small offices", description: "A fixture for the end-to-end tests. ".repeat(6) }
  const a = await admin.from("apps").insert({ ...base, developer_id: users.owner.id, name: alpha.name, slug: alpha.slug, url: alpha.url, domain: `alpha-${run}.example`, ownership_status: "verified_owner" }).select("id").single()
  expect(a.error).toBeNull(); alpha.id = a.data!.id
  const b = await admin.from("apps").insert({ ...base, developer_id: null, name: beta.name, slug: beta.slug, url: beta.url, domain: `beta-${run}.example`, ownership_status: "unclaimed" }).select("id").single()
  expect(b.error).toBeNull(); beta.id = b.data!.id

  // what an automatic run found for alpha: a privacy policy yes, no link to a subprocessor list (no answer), a DPA page that was down
  const results = [
    { check_key: "https", attribute_key: "https", outcome: "found", value_state: "yes", source_url: alpha.url, source_title: "Start page" },
    { check_key: "privacy_policy", attribute_key: "privacy_policy", outcome: "found", value_state: "yes", value_text: `${alpha.url}privacy`, source_url: `${alpha.url}privacy`, source_title: "Privacy", excerpt: "We process personal data as follows." },
    { check_key: "subprocessors_published", attribute_key: "subprocessors_published", outcome: "not_found", source_url: alpha.url },
    { check_key: "dpa_available", attribute_key: "dpa_available", outcome: "could_not_check", source_url: `${alpha.url}dpa`, http_status: 503 },
  ]
  const recorded = await admin.rpc("record_verification_run", { p_app_id: alpha.id, p_url: alpha.url, p_run_type: "automatic", p_initiated_by: null, p_results: results })
  expect(recorded.error).toBeNull()
  // what the verified owner states: a DPA. PWANova could not check it, so it stays a vendor statement.
  const stated = await admin.from("app_evidence").insert({ app_id: alpha.id, attribute_key: "dpa_available", value_state: "yes", value_text: `${alpha.url}legal/dpa`, source_url: `${alpha.url}legal/dpa`, source_type: "vendor_stated", verification_method: "vendor", status: "current", submitted_by: users.owner.id })
  expect(stated.error).toBeNull()
})

test.afterAll(async () => {
  for (const u of Object.values(users)) {
    await admin.from("buyer_requests").delete().eq("user_id", u.id)
    await admin.from("apps").delete().eq("developer_id", u.id)
  }
  await admin.from("apps").delete().in("id", [alpha.id, beta.id].filter(Boolean))
  await admin.from("companies").delete().like("slug", `%${run}%`)
  for (const u of Object.values(users)) await admin.auth.admin.deleteUser(u.id)
})

// ------------------------------------------------------------------ languages and addresses
test("every page lives under a language; old addresses arrive where the page is now", async ({ request }) => {
  const hop = async (path: string, headers: Record<string, string> = {}) => {
    const r = await request.get(path, { maxRedirects: 0, headers })
    return [r.status(), (r.headers().location ?? "").replace(ORIGIN, "")]
  }
  expect(await hop("/", { "accept-language": "de-DE,de;q=0.9,en;q=0.5" })).toEqual([307, "/de"])
  expect(await hop("/", { "accept-language": "fr-FR,fr;q=0.9" })).toEqual([307, "/en"])
  expect(await hop("/", { "accept-language": "de", cookie: "pwn_locale=en" })).toEqual([307, "/en"])
  expect(await hop(`/apps/${alpha.slug}?from=home`, { "accept-language": "de" })).toEqual([307, `/de/apps/${alpha.slug}?from=home`])
  // v1 addresses
  expect(await hop("/explore?q=invoice", { "accept-language": "en" })).toEqual([307, "/en/discover?q=invoice"])
  expect(await hop("/en/explore?q=invoice")).toEqual([308, "/en/discover?q=invoice"])
  expect(await hop("/de/top")).toEqual([308, "/de/discover?sort=rating"])
  expect(await hop("/de/trending")).toEqual([308, "/de/discover?sort=trending"])
  expect(await hop("/en/new")).toEqual([308, "/en/discover?sort=new"])
  expect(await hop("/en/ship")).toEqual([308, "/en/submit"])
  expect(await hop("/en/for-developers")).toEqual([308, "/en/for-makers"])
  expect(await hop("/en/activity")).toEqual([308, "/en/notifications"])
  expect(await hop("/en/categories/fitness")).toEqual([308, "/en/categories/health-fitness"])
  expect((await hop("/en/discover?verified=1&sort=top"))[1]).toBe("/en/discover?owner=1")
  // what exists once keeps its address
  for (const path of ["/robots.txt", "/sitemap.xml", "/manifest.webmanifest", "/api/v1/facts", "/offline"]) expect((await request.get(path, { maxRedirects: 0 })).status(), path).toBe(200)
  expect((await request.get("/en/this/page/does/not/exist")).status()).toBe(404)
  expect((await request.get("/en/collections/constructor")).status()).toBe(404)
  expect((await request.get("/en/categories/constructor")).status()).toBe(404)
})

test("a visit stores nothing; picking a language is remembered; pages name their other language", async ({ page, context, request }) => {
  await page.goto(`/en/apps/${alpha.slug}`)
  await page.goto("/en/discover")
  await page.goto("/en")
  expect((await context.cookies()).map((c) => c.name)).toEqual([])
  expect(await page.evaluate(() => [Object.keys(localStorage).length, Object.keys(sessionStorage).length])).toEqual([0, 0])

  await expect(page.locator('link[rel="alternate"][hreflang="de"]')).toHaveAttribute("href", /\/de$/)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/en$/)
  await expect(page.locator("html")).toHaveAttribute("lang", "en")

  await page.goto("/en/discover?q=ledger&fact=privacy_policy")
  await page.getByRole("group", { name: "Language" }).first().getByRole("link", { name: "DE" }).click()
  await expect(page).toHaveURL(/\/de\/discover\?q=ledger&fact=privacy_policy/)
  await expect(page.locator("html")).toHaveAttribute("lang", "de")
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ledger")
  expect((await context.cookies()).map((c) => [c.name, c.value])).toEqual([["pwn_locale", "de"]])
  const r = await request.get("/", { maxRedirects: 0, headers: { "accept-language": "en", cookie: "pwn_locale=de" } })
  expect(r.headers().location).toMatch(/\/de$/)
})

// ------------------------------------------------------------------ discover, trust, compare
test("three states are shown as three states, with where an answer comes from", async ({ page, context }) => {
  // the owner makes a statement in the dashboard; the answers are spelled out, so yes cannot mean its opposite
  await login(context, "owner")
  await page.goto(`/en/dashboard/apps/${alpha.slug}?tab=evidence`)
  await page.getByLabel("What").selectOption("no_training_on_customer_data")
  await expect(page.getByLabel("Answer").locator("option")).toHaveText(["No training on customer data", "Customer data may be used for training"])
  await page.getByLabel(/^Source URL/).fill(`${alpha.url}ai`)
  await page.getByRole("button", { name: "Save statement" }).click()
  await expect(page.getByText("Statement saved.", { exact: true })).toBeVisible()
  // what PWANova observed is not the owner's to state
  await expect(page.getByLabel("What").locator("option[value=https], option[value=pwa_manifest], option[value=eu_company]")).toHaveCount(0)
  await context.clearCookies()

  await page.goto(`/en/apps/${alpha.slug}`)
  const snapshot = page.locator("#trust")
  const row = (label: string) => snapshot.locator("li").filter({ hasText: label })
  await expect(row("Privacy policy")).toContainText("Privacy policy found")
  await expect(row("Privacy policy")).toContainText("Checked by PWANova")
  await expect(row("Data processing agreement")).toContainText("DPA available")
  await expect(row("Data processing agreement")).toContainText("Stated by the vendor")
  await expect(row("Training on customer data")).toContainText("No training on customer data")
  await expect(row("Training on customer data")).toContainText("Stated by the vendor")
  await expect(row("Subprocessors")).toContainText("Not verified")
  await expect(row("EU hosting")).toContainText("Not verified")
  await expect(snapshot).toContainText("PWANova records evidence. It does not certify legal compliance.")
  // nothing on the page claims compliance
  const text = (await page.locator("main").innerText()).toLowerCase()
  for (const claim of ["gdpr compliant", "gdpr-compliant", "certified", "guaranteed"]) expect(text).not.toContain(claim)

  // the listing that says nothing is "not verified" everywhere, never "no"
  await page.goto(`/en/apps/${beta.slug}`)
  await expect(page.locator("#trust li").filter({ hasText: "Not verified" })).toHaveCount(8)
  await expect(page.locator("#trust")).toContainText("Unverified")

  // filters: a vendor statement counts, unless only verified evidence is asked for
  await page.goto(`/en/discover?q=${run}&fact=dpa_available`)
  await expect(page.getByRole("link", { name: `Open the profile of ${alpha.name}` })).toBeVisible()
  await expect(page.getByRole("link", { name: `Open the profile of ${beta.name}` })).toHaveCount(0)
  await page.goto(`/en/discover?q=${run}&fact=dpa_available&evidence=verified`)
  await expect(page.getByText("We couldn't find a strong match yet.")).toBeVisible()
  await page.goto(`/en/discover?q=${run}&fact=privacy_policy&evidence=verified`)
  await expect(page.getByRole("link", { name: `Open the profile of ${alpha.name}` })).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/)
})

test("the evidence page keeps history: a new result is added, the old one stays", async ({ page }) => {
  const second = await admin.rpc("record_verification_run", { p_app_id: alpha.id, p_url: alpha.url, p_run_type: "scheduled", p_initiated_by: null, p_results: [
    { check_key: "privacy_policy", attribute_key: "privacy_policy", outcome: "found", value_state: "yes", value_text: `${alpha.url}legal/privacy`, source_url: `${alpha.url}legal/privacy`, source_title: "Privacy (moved)" },
    { check_key: "https", attribute_key: "https", outcome: "could_not_check", source_url: alpha.url },
  ] })
  expect(second.error).toBeNull()
  await page.goto(`/en/apps/${alpha.slug}/evidence`)
  const privacy = page.locator("#fact-privacy_policy")
  await expect(privacy.locator("li")).toHaveCount(2)
  await expect(privacy.locator("li").first()).toContainText("Current")
  await expect(privacy.locator("li").nth(1)).toContainText("Replaced")
  // HTTPS could not be re-checked: the earlier yes and its entry stay as they were
  await expect(page.locator("#fact-https li")).toHaveCount(1)
  await expect(page.locator("#fact-https")).toContainText("Served over HTTPS")
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/)
})

test("compare: pick two, one address whatever the order, unknown stays unknown", async ({ page }) => {
  await page.goto(`/en/discover?q=${run}`)
  await page.getByRole("button", { name: `Add to comparison: ${beta.name}` }).click()
  await expect(page.getByText("Add at least two apps to compare.")).toBeVisible()
  await page.getByRole("button", { name: `Add to comparison: ${alpha.name}` }).click()
  await page.getByRole("link", { name: "Compare now" }).click()
  await expect(page).toHaveURL(new RegExp(`/en/compare/${alpha.slug}-vs-${beta.slug}$`))
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`${alpha.name} vs ${beta.name}`)

  const cells = (label: string) => page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: label, exact: true }) }).getByRole("cell")
  await expect(cells("Privacy policy").nth(0)).toContainText("Privacy policy found")
  await expect(cells("Privacy policy").nth(1)).toContainText("Not verified")
  await expect(cells("Data processing agreement").nth(0)).toContainText("Stated by the vendor")
  await expect(cells("Data processing agreement").nth(1)).toContainText("Not verified")
  await expect(cells("Rating").nth(0)).toContainText("No ratings yet")
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/en/compare/${alpha.slug}-vs-${beta.slug}$`))

  // the other order and the old form of the address arrive at the same page
  await page.goto(`/en/compare/${beta.slug}-vs-${alpha.slug}`)
  await expect(page).toHaveURL(new RegExp(`/en/compare/${alpha.slug}-vs-${beta.slug}$`))
  await page.goto(`/de/compare?apps=${beta.slug},${alpha.slug}`)
  await expect(page).toHaveURL(new RegExp(`/de/compare/${alpha.slug}-vs-${beta.slug}$`))
  await expect(cells("Datenschutzerklärung").nth(1)).toContainText("Nicht geprüft")

  await page.getByRole("button", { name: `${beta.name} entfernen` }).click()
  await expect(page).toHaveURL(/\/de\/compare$/)
  await expect(page.getByText(alpha.name).first()).toBeVisible()

  // four apps are the most a comparison holds, and all four are shown
  const extra = ["gamma", "delta", "epsilon"].map((n) => ({ slug: `${n}-compare-${run}`, name: `${n} compare ${run}`, url: `https://${n}-compare-${run}.example/`, domain: `${n}-compare-${run}.example` }))
  const created = await admin.from("apps").insert(extra.map((e) => ({ ...e, category: "finance", status: "published", tagline: "A listing for the comparison", description: "A fixture for the end-to-end tests. ".repeat(6), developer_id: null, ownership_status: "unclaimed" }))).select("id")
  expect(created.error).toBeNull()
  try {
    const four = [alpha.slug, beta.slug, extra[0].slug, extra[1].slug].sort()
    await page.goto(`/en/compare/${[...four].reverse().join("-vs-")}`)
    await expect(page).toHaveURL(new RegExp(`/en/compare/${four.join("-vs-")}$`))
    await expect(page.locator("thead th[scope=col]")).toHaveCount(4)
    for (const slug of four) await expect(page.locator(`thead a[href="/en/apps/${slug}"]`)).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/)
    // a fifth app does not fit: the first four in alphabetical order stay
    const five = [...four, extra[2].slug].sort()
    await page.goto(`/en/compare/${five.join("-vs-")}`)
    await expect(page).toHaveURL(new RegExp(`/en/compare/${five.slice(0, 4).join("-vs-")}$`))
  } finally {
    await admin.from("apps").delete().in("id", (created.data ?? []).map((r) => r.id))
  }
})

// ------------------------------------------------------------------ reviews (kept from v1)
test("guest: install guidance, outbound link and a review draft that survives signing in", async ({ page, context }) => {
  await page.goto(`/en/discover?q=${run}`)
  await expect(page.getByText(alpha.name).first()).toBeVisible()
  await page.goto(`/en/apps/${alpha.slug}`)
  await expect(page.getByText("No ratings yet").first()).toBeVisible()
  await expect(page.locator(`a[href="${alpha.url}"]`).first()).toHaveAttribute("rel", /noopener/)
  // the address partners link to: the install guide opens on arrival
  await page.goto("/en")
  await page.goto(`/en/apps/${alpha.slug}#install`)
  await expect(page.getByRole("dialog")).toContainText(`alpha-${run}.example`)
  await expect(page.getByRole("dialog")).toContainText("own site, not on PWANova")
  // PWANova's own install prompt must never be used for somebody else's app
  await page.evaluate(() => { const event = new Event("beforeinstallprompt"); Object.assign(event, { prompt: () => { throw new Error("Must not install PWANova") } }); window.dispatchEvent(event) })
  await context.route(`${alpha.url}**`, (r) => r.fulfill({ body: "External app fixture" }))
  const popupPromise = page.waitForEvent("popup")
  await page.getByRole("button", { name: `Open alpha-${run}.example` }).click()
  const popup = await popupPromise; await popup.waitForLoadState(); expect(popup.url()).toBe(alpha.url); await popup.close()
  await page.getByRole("button", { name: "Done", exact: true }).click()

  await page.getByRole("button", { name: "Write a review", exact: true }).click()
  await page.getByRole("radiogroup", { name: "Your rating", exact: true }).getByRole("radio", { name: "4 stars", exact: true }).click()
  await page.getByPlaceholder("Title (optional)").fill("Draft from guest")
  await page.getByPlaceholder("What did you use it for, and how did it go?").fill("A useful app. Please improve keyboard shortcuts.")
  await page.getByRole("button", { name: "Sign in to post" }).click()
  await expect(page).toHaveURL(/\/en\/sign-in\?next=/)
  const returnPath = new URL(page.url()).searchParams.get("next")!
  expect(returnPath.startsWith(`/en/apps/${alpha.slug}?reviewDraft=`)).toBeTruthy()
  await login(context, "reviewer")
  await page.goto(returnPath)
  await expect(page.getByPlaceholder("Title (optional)")).toHaveValue("Draft from guest")
  await page.getByRole("button", { name: "Post review", exact: true }).click()
  await expect(page.getByText("Review posted.", { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText("Draft from guest", { exact: true })).toBeVisible()
  await expect(page.getByText("Registered PWANova user").first()).toBeVisible()

  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page.getByText("Saved to your apps", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Follow", exact: true }).click()
  await expect(page.getByText(`You follow ${alpha.name}`, { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toHaveAttribute("aria-pressed", "true")
  await page.goto("/en/saved")
  await expect(page.getByText(alpha.name).first()).toBeVisible()
})

test("owner replies and publishes an update; the follower is notified in the app", async ({ page, context }) => {
  await login(context, "owner")
  await page.goto(`/en/apps/${alpha.slug}`)
  await expect(page.getByText("You cannot rate or review your own app.")).toBeVisible()
  await page.getByRole("button", { name: "Respond", exact: true }).click()
  await page.getByPlaceholder("Write a public response").fill("Thanks. Keyboard shortcuts are on our roadmap.")
  await page.getByRole("button", { name: "Post response" }).click()
  await expect(page.getByText("Maker response", { exact: false })).toBeVisible()

  await page.goto(`/en/dashboard/apps/${alpha.slug}?tab=updates`)
  await page.getByLabel("Title").fill("Keyboard shortcuts")
  await page.getByLabel(/^Details/).fill("Every action now has a shortcut.")
  await page.getByRole("button", { name: "Publish", exact: true }).click()
  await expect(page.getByText("Update published. Followers are notified in the app.", { exact: true })).toBeVisible()

  await login(context, "reviewer")
  await page.goto("/en")
  await expect(page.getByRole("link", { name: /^Notifications \(1\)/ })).toBeVisible()
  await page.goto("/en/notifications")
  await expect(page.getByText(`${alpha.name} published an update`)).toBeVisible()
  await expect(page.getByText("Keyboard shortcuts", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Mark all as read" }).click()
  await expect(page.getByRole("button", { name: "Mark all as read" })).toHaveCount(0)
})

test("a reviewer edits, and rating and text can be removed independently", async ({ page, context }) => {
  await login(context, "reviewer")
  await page.goto(`/en/apps/${alpha.slug}`)
  await page.getByRole("button", { name: "Edit your review" }).click()
  await page.getByPlaceholder("Title (optional)").fill("Updated experience")
  await page.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect(page.getByText("Review updated.", { exact: true })).toBeVisible()
  await page.getByRole("radiogroup", { name: "Your rating", exact: true }).getByRole("radio", { name: "2 stars" }).click()
  await expect.poll(async () => (await admin.from("reviews").select("rating").eq("app_id", alpha.id).single()).data?.rating).toBe(2)
  await page.getByRole("button", { name: "Remove rating (the review text stays)" }).click()
  await expect(page.getByText("Rating removed. Your review text is unchanged.", { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText("Updated experience", { exact: true })).toBeVisible()
  await expect(page.getByText("No ratings yet").first()).toBeVisible()
  await page.getByRole("button", { name: "Edit your review" }).click()
  await page.getByRole("button", { name: "Delete review text" }).click()
  await expect(page.getByText("Review text deleted. Your rating is unchanged.", { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText("Updated experience", { exact: true })).toHaveCount(0)
  await page.request.post("/auth/sign-out")
  await page.goto("/en/dashboard")
  await expect(page.getByText("Sign in to manage your listings and see how they are used.")).toBeVisible()
})

// ------------------------------------------------------------------ submitting and claiming
test("submitting: duplicates are found, a new listing waits for review, an admin publishes it", async ({ page, context }) => {
  await login(context, "submitter")
  await page.goto("/en/submit")
  // an address that is already listed
  await page.getByLabel("Website URL").fill(alpha.url)
  await page.getByRole("button", { name: "Analyse" }).click()
  await expect(page.getByText("This app is already listed.")).toBeVisible()
  await expect(page.getByRole("link", { name: "Claim this app" })).toHaveAttribute("href", `/en/apps/${alpha.slug}/claim`)
  await expect(page.getByRole("button", { name: "Submit for review" })).toHaveCount(0)

  await page.getByRole("button", { name: "Use another address" }).click()
  await page.getByLabel("Website URL").fill(`https://submission-${run}.example/`)
  await page.getByRole("button", { name: "Analyse" }).click()
  await expect(page.getByText("PWANova could not reach this address.", { exact: false })).toBeVisible()
  await page.getByLabel("Name", { exact: true }).fill(`Submitted Ledger ${run}`)
  await page.getByLabel("Category").selectOption("finance")
  await page.getByLabel("Short tagline").fill("A real database submission from the UI")
  await page.getByLabel(/^Company name/).fill(`Ledger Works ${run}`)
  await page.getByLabel(/^Company country/).selectOption("DE")
  await page.getByLabel(/^Privacy policy URL/).fill(`https://submission-${run}.example/privacy`)
  await page.getByRole("button", { name: "Submit for review" }).click()
  await expect(page.getByRole("heading", { name: "Your app is submitted" })).toBeVisible()

  const { data: app } = await admin.from("apps").select("id, slug, status, ownership_status, company_id").eq("developer_id", users.submitter.id).single()
  expect([app?.status, app?.ownership_status]).toEqual(["pending", "claim_pending"])
  // what an unverified submitter typed waits for review and is not a vendor statement
  const evidence = (await admin.from("app_evidence").select("attribute_key, source_type, status").eq("app_id", app!.id).eq("submitted_by", users.submitter.id)).data!
  expect(evidence.length).toBeGreaterThan(0)
  expect(evidence.every((e) => e.source_type === "user_submitted" && e.status === "pending_review")).toBeTruthy()

  await page.getByRole("link", { name: "Prove ownership now" }).click()
  await expect(page).toHaveURL(new RegExp(`/en/apps/${app!.slug}/claim$`))
  await expect(page.getByText("This listing is waiting for review.", { exact: false })).toBeVisible()
  await expect(page.getByText(`https://submission-${run}.example/.well-known/pwanova-verification.txt`, { exact: false })).toBeVisible()
  await page.getByRole("button", { name: "Verify ownership", exact: true }).click()
  await expect(page.locator("main").getByRole("alert")).toBeVisible()
  expect((await admin.from("apps").select("ownership_status").eq("id", app!.id).single()).data?.ownership_status).toBe("claim_pending")

  // not public yet
  await context.clearCookies()
  expect((await page.request.get(`/en/apps/${app!.slug}`)).status()).toBe(404)

  await login(context, "admin")
  await page.goto("/en/admin")
  const row = page.locator("li").filter({ hasText: `Submitted Ledger ${run}` }).first()
  await row.getByRole("button", { name: "Approve", exact: true }).click()
  await expect.poll(async () => (await admin.from("apps").select("status").eq("id", app!.id).single()).data?.status).toBe("published")
  await page.goto("/en/admin?tab=audit")
  await expect(page.getByText("approve").first()).toBeVisible()

  await context.clearCookies()
  await page.goto(`/en/apps/${app!.slug}`)
  await expect(page.getByRole("heading", { name: `Submitted Ledger ${run}`, exact: true })).toBeVisible()
  // the company an unverified submitter typed is not shown, and ownership is shown as not verified
  await expect(page.getByText(`Ledger Works ${run}`)).toHaveCount(0)
  await expect(page.getByText("Ownership not verified").first()).toBeVisible()
  await expect(page.locator("#trust li").filter({ hasText: "Privacy policy" })).toContainText("Not verified")
})

// ------------------------------------------------------------------ launches
test("a launch is submitted by the owner, approved by a moderator and listed for thirty days", async ({ page, context }) => {
  await login(context, "owner")
  await page.goto(`/en/dashboard/apps/${alpha.slug}?tab=launches`)
  const headline = `Alpha Ledger 2.0 ${run}`
  await page.getByLabel(/^Headline/).first().fill(headline)
  await page.getByLabel(/^Launch message/).first().fill("Shared workspaces for small offices.")
  await page.getByRole("button", { name: "Submit for review" }).click()
  await expect(page.getByText("Launch submitted. A moderator will review it.", { exact: true })).toBeVisible()
  await expect(page.getByText("Waiting for review").first()).toBeVisible()
  // one launch at a time: the form is gone while one is in progress
  await expect(page.getByRole("button", { name: "Submit for review" })).toHaveCount(0)

  await context.clearCookies()
  await page.goto("/en/launches")
  await expect(page.getByText(headline)).toHaveCount(0)

  await login(context, "admin")
  await page.goto("/en/admin")
  await page.locator("li").filter({ hasText: headline }).getByRole("button", { name: "Approve launch" }).click()
  await expect.poll(async () => (await admin.from("launches").select("status").eq("app_id", alpha.id).single()).data?.status).toBe("approved")
  const { data: launch } = await admin.from("launches").select("slug, window_start, window_end").eq("app_id", alpha.id).single()
  expect(Math.round((Date.parse(launch!.window_end!) - Date.parse(launch!.window_start!)) / 86_400_000)).toBe(30)

  await context.clearCookies()
  await page.goto("/de/launches")
  await page.getByRole("link", { name: headline }).click()
  await expect(page).toHaveURL(new RegExp(`/de/launches/${launch!.slug}$`))
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(headline)
  await expect(page.getByText("noch 30 Tage").or(page.getByText("noch 29 Tage"))).toBeVisible()
})

// ------------------------------------------------------------------ buyer requests
test("a request: matched on documented facts, contact details only by consent, per vendor", async ({ page, context }) => {
  await login(context, "buyer")
  await page.goto("/en/requests/new")
  const title = `Invoicing for a small office ${run}`
  await page.getByLabel("Title").fill(title)
  // contact details do not belong in the text that vendors see
  await page.getByLabel("Problem and use case").fill("We write 40 invoices a month. Call me on +49 30 1234567.")
  await page.getByRole("button", { name: "Create request and find matches" }).click()
  await expect(page.locator("main").getByRole("alert")).toContainText("remove e-mail addresses and phone numbers")

  await page.getByLabel("Problem and use case").fill("We write about 40 invoices a month and need a tool with a data processing agreement.")
  await page.getByRole("checkbox", { name: "Finance" }).check()
  await page.getByRole("checkbox", { name: "DPA available" }).check()
  await page.getByRole("checkbox", { name: "Privacy policy found" }).check()
  await page.getByLabel(/^Name/).fill("Bea Buyer")
  await page.getByLabel(/^E-mail/).first().fill(`bea-${run}@example.com`)
  await page.getByLabel(/^Phone/).fill("+49 30 1234567")
  await page.getByRole("button", { name: "Create request and find matches" }).click()
  await expect(page).toHaveURL(/\/en\/requests\/[a-z0-9]{12}$/)
  const requestPath = new URL(page.url()).pathname

  // the short list: alpha documents both requirements, beta documents nothing and is not listed
  const list = page.locator("ol > li")
  await expect(list.filter({ hasText: alpha.name })).toContainText("2 of 2 requirements documented")
  await expect(list.filter({ hasText: beta.name })).toHaveCount(0)
  await expect(page.getByText("No vendor has responded yet.")).toBeVisible()

  // a private request is not visible to anybody else, signed in or not
  await context.clearCookies()
  expect((await page.request.get(requestPath)).status()).toBe(404)
  await login(context, "reviewer")
  expect((await page.request.get(requestPath)).status()).toBe(404)
  await page.goto("/en/requests")
  await expect(page.getByText(title)).toHaveCount(0)

  // the matched vendor sees the requirements, never the person
  await login(context, "owner")
  await page.goto("/en/dashboard/requests")
  const card = page.locator("li").filter({ hasText: title })
  await expect(card).toContainText("DPA available")
  const vendorView = await page.locator("main").innerText()
  for (const secret of ["Bea Buyer", `bea-${run}@example.com`, "1234567", users.buyer.email]) expect(vendorView).not.toContain(secret)
  await card.getByLabel(/^Message to the buyer/).fill("We offer a DPA and host in Frankfurt.")
  await card.getByRole("button", { name: "We are interested" }).click()
  await expect(card.getByText("Waiting for the buyer")).toBeVisible()
  // the database refuses direct reads of the contact table, whatever the client sends
  const spy = createServerClient(url, anon, { cookies: { getAll: () => [], setAll: () => {} } })
  await spy.auth.signInWithPassword({ email: users.owner.email, password })
  expect((await spy.from("buyer_request_contacts").select("*")).data).toEqual([])

  // the buyer shares the e-mail address, and only that
  await login(context, "buyer")
  await page.goto(requestPath)
  await expect(page.getByText("We offer a DPA and host in Frankfurt.")).toBeVisible()
  await page.getByRole("button", { name: "Share contact details" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("checkbox", { name: /^Name/ }).uncheck()
  await expect(dialog.getByRole("checkbox", { name: /^Phone/ })).not.toBeChecked()
  await expect(dialog.getByRole("button", { name: "Share contact details" })).toBeDisabled()
  await dialog.getByRole("checkbox", { name: /^I agree that PWANova passes/ }).check()
  await dialog.getByRole("button", { name: "Share contact details" }).click()
  await expect(page.getByText(/^Shared on /)).toContainText("E-mail")
  const consent = (await admin.from("buyer_contact_consents").select("shared_fields, consent_text, revoked_at, granted_by").single()).data!
  expect(consent.shared_fields).toEqual(["contact_email"])
  expect(consent.consent_text).toContain(alpha.name)
  expect(consent.granted_by).toBe(users.buyer.id)

  await login(context, "owner")
  await page.goto("/en/dashboard/requests")
  const shared = page.locator("li").filter({ hasText: title })
  await expect(shared).toContainText(`bea-${run}@example.com`)
  await expect(shared).not.toContainText("Bea Buyer")
  await expect(shared).not.toContainText("1234567")

  // consent withdrawn: the details are gone for the vendor
  await login(context, "buyer")
  await page.goto(requestPath)
  await page.getByRole("button", { name: "Withdraw" }).click()
  await expect.poll(async () => (await admin.from("buyer_contact_consents").select("revoked_at").single()).data?.revoked_at).not.toBeNull()
  await login(context, "owner")
  await page.goto("/en/dashboard/requests")
  await expect(page.locator("main")).not.toContainText(`bea-${run}@example.com`)
})

// ------------------------------------------------------------------ public API, badge, embeds
test("public API: facts with their origin, nothing private, gone when a listing is suspended", async ({ request, page }) => {
  let r = await request.get(`/api/v1/apps/${alpha.slug}`)
  expect(r.status()).toBe(200)
  expect(r.headers()["access-control-allow-origin"]).toBe("*")
  const { data, apiVersion } = await r.json()
  expect(apiVersion).toBe("1")
  const fact = (key: string) => data.facts.find((f: { key: string }) => f.key === key)
  expect(fact("privacy_policy")).toMatchObject({ state: "yes", origin: "verified", verified: { by: "pwanova_observed" } })
  expect(fact("dpa_available")).toMatchObject({ state: "yes", origin: "vendor", verified: null, lastAttempt: { outcome: "could_not_check" } })
  expect(fact("eu_hosting_available")).toBeUndefined() // unknown is absent, never "no"
  expect(JSON.stringify(data)).not.toMatch(/email|user_id|developer_id|token|submitted_by/i)

  // nobody has rated it: no rating at all, not an average of zero
  const rating = async () => (await (await request.get(`/api/v1/apps/${alpha.slug}`)).json()).data.rating
  await admin.from("ratings").delete().eq("app_id", alpha.id)
  expect(await rating()).toBeNull()
  expect((await admin.from("ratings").insert({ app_id: alpha.id, user_id: users.buyer.id, rating: 4 })).error).toBeNull()
  expect(await rating()).toEqual({ average: 4, count: 1 })

  const de = await (await request.get(`/api/v1/apps?q=${run}&fact=privacy_policy&lang=de`)).json()
  expect(de.data.map((a: { slug: string }) => a.slug)).toEqual([alpha.slug])
  expect(de.data[0].category.name).toBe("Finanzen")
  // `lang` is the language of the answer; `language` filters by the languages an app is available in
  expect((await (await request.get(`/api/v1/apps?q=${run}&language=de`)).json()).data).toEqual([])
  await admin.from("app_languages").insert({ app_id: alpha.id, language_code: "de" })
  expect((await (await request.get(`/api/v1/apps?q=${run}&language=de&lang=en`)).json()).data.map((a: { slug: string }) => a.slug)).toEqual([alpha.slug])
  expect((await (await request.get(`/api/v1/apps/${alpha.slug}/evidence`)).json()).data.length).toBeGreaterThan(2)
  expect((await (await request.get(`/api/v1/apps/by-domain?domain=alpha-${run}.example`)).json()).data[0].slug).toBe(alpha.slug)
  expect((await request.get("/api/v1/apps/by-domain?domain=not a domain")).status()).toBe(400)
  expect((await request.get("/api/v1/apps/..%2F..%2Fetc")).status()).toBeGreaterThanOrEqual(400)
  expect((await (await request.get("/api/v1/categories?lang=de")).json()).data.length).toBeGreaterThan(10)
  expect((await (await request.get("/api/v1/facts")).json()).states.unknown).toContain("never")

  // v1 endpoint, badge and embed keep working
  r = await request.get(`/api/public/apps/by-domain?id=${alpha.id}`)
  expect(r.status()).toBe(200)
  expect(JSON.stringify(await r.json())).not.toMatch(/token|user_id|email|developer_id/)
  expect(await (await request.get(`/api/badge/${beta.slug}`)).text()).toContain("View on PWANova")
  expect(await (await request.get(`/api/badge/${beta.slug}?lang=de`)).text()).toContain("Bei PWANova ansehen")
  await page.goto("/en/partners")
  await expect(page.getByRole("button", { name: "Copy snippet" }).first()).toBeVisible()

  await admin.from("apps").update({ status: "suspended" }).eq("id", alpha.id)
  for (const path of [`/api/v1/apps/${alpha.slug}`, `/api/v1/apps/${alpha.slug}/evidence`, `/api/public/apps/by-domain?id=${alpha.id}`, `/api/badge/${alpha.slug}`, `/embed/app/${alpha.slug}`, `/en/apps/${alpha.slug}`, `/en/apps/${alpha.slug}/evidence`, `/en/compare/${alpha.slug}-vs-${beta.slug}`]) {
    expect((await request.get(path, { maxRedirects: 0 })).status(), path).not.toBe(200)
  }
  expect((await (await request.get(`/api/v1/apps?q=${run}`)).json()).data.map((a: { slug: string }) => a.slug)).not.toContain(alpha.slug)
  await admin.from("apps").update({ status: "published" }).eq("id", alpha.id)
})

test("search engines: own pages only, both languages, no private pages, structured data without invented ratings", async ({ request, page }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text()
  expect(sitemap).toContain(`/en/apps/${alpha.slug}</loc>`)
  expect(sitemap).toContain(`/de/apps/${alpha.slug}</loc>`)
  expect(sitemap).toContain('hreflang="de"')
  for (const hidden of ["/dashboard", "/admin", "/saved", "/requests/", "/sign-in", "metro-fit", "/explore"]) expect(sitemap, hidden).not.toContain(hidden)

  await page.goto(`/en/apps/${beta.slug}`)
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents()
  const product = ld.map((t) => JSON.parse(t)).find((j) => j["@type"] === "SoftwareApplication")
  expect(product.name).toBe(beta.name)
  expect(product.aggregateRating).toBeUndefined() // nobody has rated it
  expect(product.offers).toBeUndefined() // no price was stated
  for (const path of ["/en/dashboard", "/en/saved", "/en/notifications", "/en/profile", "/en/sign-in", `/en/apps/${alpha.slug}/claim`]) {
    await page.goto(path)
    await expect(page.locator('meta[name="robots"]'), path).toHaveAttribute("content", /noindex/)
  }
  await page.goto("/de/legal/imprint")
  await expect(page.getByRole("note")).toContainText("Vorlage")
  await expect(page.getByText("noch nicht eingetragen").first()).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/)
})

// ------------------------------------------------------------------ small screens
test("narrow screens: no sideways scrolling, filters in a sheet, the tray above the tab bar", async ({ page, context }) => {
  test.setTimeout(180_000)
  // German has the longer words, so German is what is measured
  const open = ["/de", "/de/discover", `/de/discover?q=${run}&fact=privacy_policy`, "/de/categories", "/de/categories/finance", "/de/collections", `/de/apps/${alpha.slug}`, `/de/apps/${alpha.slug}/evidence`,
    `/de/alternatives/${alpha.slug}`, "/de/compare", `/de/compare/${alpha.slug}-vs-${beta.slug}`, "/de/launches", "/de/requests", "/de/requests/new", "/de/submit", "/de/sign-in", "/de/for-makers", "/de/pricing", "/de/partners",
    "/de/verification-methodology", "/de/how-ranking-works", "/de/sponsorship", "/de/review-rules", "/de/legal/imprint", "/de/legal/privacy", "/de/legal/terms"]
  const sweep = async (width: number, paths: string[]) => {
    await page.setViewportSize({ width, height: 667 })
    for (const path of paths) {
      await page.goto(path)
      expect(await sticksOut(page), `${path} on a screen of ${width}px`).toEqual([])
    }
  }
  await sweep(320, open)
  await sweep(375, open)
  await login(context, "owner")
  const tabs = ["overview", "profile", "evidence", "pricing", "details", "updates", "launches", "plan"].map((tab) => `/de/dashboard/apps/${alpha.slug}?tab=${tab}`)
  await sweep(320, ["/de/dashboard", ...tabs, "/de/dashboard/requests", "/de/saved", "/de/notifications", "/de/profile"])
  await login(context, "admin")
  await sweep(375, ["queue", "reports", "listings", "evidence", "requests", "plans", "settings", "audit"].map((tab) => `/en/admin?tab=${tab}`))
  await context.clearCookies()
  // the comparison pages above have put their apps into the selection; start without one
  await page.evaluate(() => localStorage.clear())

  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto(`/de/discover?q=${run}`)
  const sheet = page.getByRole("dialog")
  // the development server hydrates slowly; a click that comes too early is repeated
  await expect(async () => {
    if (!(await sheet.isVisible())) await page.getByRole("button", { name: /^Filter/ }).click({ timeout: 2000 })
    await expect(sheet).toBeVisible({ timeout: 2000 })
  }).toPass({ timeout: 20_000 })
  await sheet.getByRole("checkbox", { name: /Datenschutzerklärung gefunden/ }).check()
  await expect(page).toHaveURL(/fact=privacy_policy/)
  await sheet.getByRole("button", { name: /^Ergebnisse anzeigen/ }).click()
  await expect(page.getByRole("link", { name: `Profil von ${alpha.name} öffnen` })).toBeVisible()
  expect(await noOverflow(page)).toBeTruthy()

  await page.getByRole("button", { name: `Zum Vergleich hinzufügen: ${alpha.name}` }).click()
  const tray = page.getByRole("complementary", { name: "Vergleich" })
  await expect(tray).toBeVisible()
  const [trayBox, navBox] = await Promise.all([tray.boundingBox(), page.getByRole("navigation", { name: "Navigation" }).boundingBox()])
  expect(trayBox!.y + trayBox!.height).toBeLessThanOrEqual(navBox!.y)

  await page.goto(`/en/apps/${alpha.slug}#install`)
  await expect(page.getByRole("dialog")).toBeVisible()
  expect(await noOverflow(page)).toBeTruthy()
})

// ------------------------------------------------------------------ accounts and attribution
test("a new account signs up by e-mail and returns to where it wanted to go", async ({ page, request }) => {
  const email = `v2-signup-${run}@example.com`
  try {
    await page.goto("/de/sign-in?next=%2Fde%2Fdashboard")
    await page.getByRole("textbox", { name: "E-Mail-Adresse", exact: true }).fill(email)
    await page.getByRole("button", { name: "Anmeldelink per E-Mail senden" }).click()
    await expect(page.getByRole("status")).toContainText(email)
    let messageId = ""
    await expect.poll(async () => {
      const inbox = await (await request.get("http://127.0.0.1:55324/api/v1/messages")).json()
      const message = inbox.messages?.find((m: { ID: string; To: { Address: string }[] }) => m.To.some((t) => t.Address === email))
      messageId = message?.ID ?? ""
      return Boolean(messageId)
    }).toBeTruthy()
    const message = await (await request.get(`http://127.0.0.1:55324/api/v1/message/${messageId}`)).json()
    const link = (message.HTML as string).match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1].replaceAll("&amp;", "&")
    if (!link) throw new Error("Local verification email has no auth link")
    // the address the provider returns to carries no parameters, so it matches the allow-list exactly
    expect(new URL(link).searchParams.get("redirect_to")).toBe(`${ORIGIN}/auth/callback`)
    await page.goto(link)
    await page.waitForURL((u) => u.pathname === "/de/dashboard")
    await expect(page.getByRole("heading", { name: "Anbieter-Dashboard", exact: true })).toBeVisible()
    expect((await page.context().cookies()).map((c) => c.name)).not.toContain("pwn_next")
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const user = data.users.find((u) => u.email === email)
    expect((await admin.from("profiles").select("role, is_verified").eq("id", user!.id).single()).data).toEqual({ role: "user", is_verified: false })
  } finally {
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const user = data.users.find((u) => u.email === email)
    if (user) await admin.auth.admin.deleteUser(user.id)
  }
})

test("a partner link is credited from the address, without a cookie; the language edition is recorded", async ({ request, page, context }) => {
  const ref = `board-${run}`
  const { data: partner, error } = await admin.from("partners").insert({ name: "Fictional local launch board", slug: ref, referral_code: ref, status: "active" }).select("id").single()
  expect(error).toBeNull()
  // a listing nobody has opened in this run: a second view within half an hour would not be counted
  const gamma = await admin.from("apps").insert({ category: "finance", status: "published", tagline: "A listing for the partner link", description: "A fixture for the end-to-end tests. ".repeat(6), developer_id: null, name: `Gamma Ledger ${run}`, slug: `gamma-ledger-${run}`, url: `https://gamma-${run}.example/`, domain: `gamma-${run}.example`, ownership_status: "unclaimed" }).select("id, slug").single()
  expect(gamma.error).toBeNull()
  const app = gamma.data!
  const events = (type: string) => admin.from("app_events").select("partner_id, source, metadata").eq("app_id", app.id).eq("event_type", type)
  try {
    await admin.from("app_sources").insert({ app_id: app.id, source_name: "Original launch board", source_type: "launched_on" })
    await context.clearCookies()
    await page.goto(`/de/apps/${app.slug}?ref=${ref}`)
    await expect.poll(async () => (await events("view")).data).toEqual([{ partner_id: partner!.id, source: "partner", metadata: { locale: "de" } }])
    expect((await context.cookies()).map((c) => c.name)).toEqual([])
    // the same view again within half an hour is not counted twice
    await page.reload()
    await page.waitForTimeout(800)
    expect((await events("view")).data?.length).toBe(1)
    // an unknown code is not a partner
    expect((await request.post("/api/events", { data: { appId: app.id, type: "open_app", ref: `unknown-${run}`, locale: "en" }, headers: { origin: ORIGIN } })).status()).toBe(204)
    expect((await events("open_app")).data).toEqual([{ partner_id: null, source: "direct", metadata: { locale: "en" } }])
    // events from another site are refused; the launch source is untouched
    expect((await request.post("/api/events", { data: { appId: app.id, type: "share" }, headers: { origin: "https://evil.example" } })).status()).toBe(403)
    expect((await events("share")).data).toEqual([])
    expect((await admin.from("app_sources").select("source_name").eq("app_id", app.id).single()).data?.source_name).toBe("Original launch board")
  } finally {
    await admin.from("apps").delete().eq("id", app.id)
    await admin.from("partners").delete().eq("id", partner!.id)
  }
})
