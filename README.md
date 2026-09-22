# PWANova

**The distribution layer for the open web.**

Users: **Discover. Trust. Install.**
Developers: **Build anywhere. Launch anywhere. Live on PWANova.**
Partners: **You help apps launch. We help them keep growing.**

Existing stack retained: Next.js 16, React, TypeScript, Tailwind/shadcn, Supabase Auth/Postgres/Storage and Vercel. This branch is a **closed-beta candidate**, not a production-readiness certification. Evidence and remaining gates: [audit](docs/beta-audit.md), [release checklist](docs/beta-release-checklist.md), [pilot and unsent invitations](docs/beta-pilot.md).

## Local setup

```sh
npm ci
supabase start
```

Docker is required. The checked-in local configuration uses project `pwanova-beta-local`, API port **55321**, Postgres **55322**, Studio **55323**, and local email inbox **55324**. It does not link to a remote project. Copy `.env.example` to ignored `.env.local` and fill **local** API/anon/service keys from your local Supabase instance. Keep `NEXT_PUBLIC_SITE_URL=http://localhost:3000`, `DEMO_MODE=false`, `SHOW_DEMO_DATA=false`. Then `npm run dev`.

Sign in via email magic link; local messages are captured by the local inbox, not sent to real recipients. Enable Google/GitHub buttons only after configuring those providers and setting their `NEXT_PUBLIC_AUTH_*` flags. `/auth/callback` must be in Supabase's allowed redirect URLs. Administrators must be provisioned explicitly by a trusted database operator; no first-user admin behavior exists.

For a read-only, fabricated development demonstration without Supabase, use `DEMO_MODE=true`. Production with missing credentials does **not** invent a backend or catalog. Seeded `is_demo` data stays out of normal catalog, direct app pages, search, API, embeds and dashboards. `/partners/demo` and `_example` are explicit fictional integration examples, never real partners or real analytics.

## Core flows

- Developer: `/ship` → submit (always pending) → `/apps/{slug}/claim` → publish the exact verification file → verify ownership → administrator approves separately → public listing → developer replies → `/dashboard?days=7` or `30`.
- Visitor: `/explore` → app page → open the external app or read `#install` guidance without signing in. Sign in to save, rate, review, edit or remove your own feedback.
- One canonical rating per `(user_id, app_id)`. A review's stars are an atomic projection of that row. Deleting review text preserves the rating; removing the rating preserves text with no stars. Owners cannot rate their own apps. Ranking uses a confidence-weighted score; client-generated outbound events no longer influence that trusted score.
- Guest review drafts are bounded, validated, expire after 24 hours, and survive an auth round-trip using an opaque recovery ID. Signed-in drafts are associated with that user. They are never posted automatically. Local browser storage may be unavailable in private modes.
- `/admin`: approve, reject, hide/suspend, handle reports, hide rule-breaking review text with a reason, and inspect the audit log. Ownership disputes use a separate administrative reassignment operation and require fresh verification/moderation. Low ratings alone do not justify removal; see `/review-rules`.

## Ownership, identity and checks

The beta offers one method: `https://<exact-app-origin>/.well-known/pwanova-verification.txt`, containing the issued token only. Tokens use two random UUIDs, expire in three days, and bind user, app and current URL. Restart rotates the token. Verification accepts no redirects. Finalization locks the app and claim, compares token/URL/expiry/status, and cannot replace a verified owner. DNS/meta/provider methods are unavailable for the beta.

Canonical identity is **exact origin + case-sensitive pathname**, ignoring query/fragment and normalizing trailing slashes. `a.vercel.app` and `b.vercel.app` remain separate. `/one` and `/two` on the same origin can be separate apps. Query-only app identities are not supported by this beta; use distinct stable paths. The origin's controller can verify multiple path-based apps; path isolation does not prove separate infrastructure ownership. The database uniqueness index prevents duplicate canonical URLs, including competing submissions. Existing conflicts cause migration failure for manual resolution, not silent merges or data deletion.

Changing the app URL resets ownership, technical observations and publication approval, and expires outstanding claims. Scanner results commit only if the URL still matches. Public labels separate **Ownership verified**, URL reachability, HTTPS and manifest observations. Browser installation, responsive behavior, service worker activation, offline, push and security auditing remain **Unknown** unless independently tested. HTTPS and manifest detection are not safety/installability guarantees.

All untrusted HTTP requests (metadata, manifest, ownership and raster-image proxy) use scheme/default-port checks, IPv4/IPv6 restrictions, connection-time DNS validation, redirect validation, a shared deadline, and byte caps. No user cookies/internal credentials are forwarded; no remote code runs. Raster media excludes SVG/HTML and uses `nosniff`. Private/local addresses remain blocked even during development.

## Partner Kit

The existing API is extended, not duplicated:

```text
GET /api/public/apps/by-domain?domain=app.example
GET /api/public/apps/by-domain?url=https%3A%2F%2Fapp.example%2Ftool
GET /api/public/apps/by-domain?id=<stable-app-uuid>
GET /api/badge/<slug>
GET /embed/app/<slug>?ref=<registered-code>
```

Use ID or full URL for domains hosting several apps: domain-only lookup returns **409** when ambiguous. Other errors: **400** invalid input, **404** unpublished/missing app, **429** shared rate limit (API: 60/minute per proxy-derived IP). Successful public API and badge responses use `no-store`; invalidate old CDN caches when upgrading from an older deployment.

The API includes stable ID, name, canonical PWANova page URL, `rating` (`null` for no ratings), counts, ownership status/method/time, check observations/evidence/time, and install-guidance/badge/embed URLs. `null` check values mean Unknown. The legacy `verified` alias now means **ownership only**. There are no email addresses, user IDs, private analytics or claim tokens. Hidden/rejected/suspended/pending apps disappear from all public channels. SVG text is escaped; no tracking JavaScript is required.

`/partners` includes the live preview, copyable iframe/image snippet and API example. `/partners/demo` demonstrates a fictional board and a non-official referral. Existing brands are neither claimed nor implied to be partners. To enable a consenting real board, an administrator creates an active `partners` row and assigns its user in `partner_members`; that user then sees its 30-day aggregate metrics and its own referral snippet on `/partners`. Membership cannot be self-assigned by URL parameter.

## Analytics and data handling

Launch source (`app_sources.launched_on`), discovery source (`discovered_via`), current referral partner (`app_events.partner_id`) and traffic channel (`source`) are distinct. New visits never overwrite launch history. Only active database partner codes receive attribution. Unknown query codes do not create partners.

Dashboard periods are 7/30 days: page views → outbound opens → guidance views; install intents count clicks on the install control, **not completed installs**. Saves/ratings/reviews count surviving records created during the period; the average rating is the current aggregate. Counts are events/records, not unique people. No external usage, retention or browser-confirmed installation is claimed. No external SDK, fingerprint or cross-site identifier is sent to app sites.

Public client events are deduplicated per app/type/IP bucket for 30 seconds and rate-limited in Postgres. IPs are daily server-keyed hashes in temporary rate-limit keys, not raw event fields; counters expire after a day. This is spam reduction, not unique-user measurement. Production fails closed when shared rate limiting is unavailable. Run behind a trusted proxy that overwrites forwarding headers (the intended deployment is Vercel).

Raw events have a **180-day retention helper** (`purge_old_events`, used by the authenticated maintenance route). The existing `vercel.json` declares daily maintenance; confirm `CRON_SECRET` and actual execution in the authorized deployment. No production scheduler was changed by this task. Private dashboard/API/auth responses are never service-worker cached; v2 invalidates old local caches and retains only static assets plus the offline page.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run verify:supabase
npx playwright install chromium
npm run test:e2e
npm run build
```

`npm test` uses the existing Node test runner and PGlite; it checks fresh schema and seeded-schema upgrade, data integrity, roles and network policy. `verify:supabase` uses real local Auth tokens/PostgREST/Storage with disposable fixtures and refuses remote URLs. Browser tests use Playwright with guest, user A/B, owner A/B and admin fixtures. Browser traces are disabled to avoid retaining auth/claim credentials in reports. No test runner may be pointed at production.

Only `20260922213419_closed_beta_integrity.sql` is new in this branch. Previous migrations are retained. Coordinate deployment of the new migration and code because the insecure legacy claim RPC signature is removed. See the release checklist before authorizing any production migration, merge or deployment. Real phones, real partner integrations and real public-origin ownership verification remain separate pilot gates.
