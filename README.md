# PWANova

**The European discovery and trust platform for modern web, AI and PWA applications.**

Discover → verify → compare → launch → buy. PWANova records what it found about a product, where
and when, and keeps it apart from what the vendor states. It does not certify anything.

Stack: Next.js 16, React 19, TypeScript, Tailwind 4 with shadcn/ui, Supabase (Auth, Postgres,
Storage), Vercel. English and German.

## Documentation

| Document | Content |
| --- | --- |
| [Audit](docs/PWANOVA_V2_AUDIT.md) | version 1 as it was, and what V2 had to change |
| [Architecture](docs/PWANOVA_V2_ARCHITECTURE.md) | how the parts fit together |
| [Data model](docs/PWANOVA_V2_DATA_MODEL.md) | tables, origins, states, functions |
| [Verification](docs/PWANOVA_V2_VERIFICATION.md) | what is checked, how, and what is not concluded |
| [Security](docs/PWANOVA_V2_SECURITY.md) | roles, row level security, privacy, limits, open points |
| [Migration](docs/PWANOVA_V2_MIGRATION.md) | the eleven migrations and what they do to existing data |
| [Redirects](docs/PWANOVA_V2_REDIRECTS.md) | old addresses and where they arrive |
| [Deployment](docs/PWANOVA_V2_DEPLOYMENT.md) | release steps, settings, way back |
| [Report](docs/PWANOVA_V2_REPORT.md) | what was implemented, test results, open points |

Version 1 (closed beta): [audit](docs/beta-audit.md), [release checklist](docs/beta-release-checklist.md),
[pilot](docs/beta-pilot.md), [production release of 2026-09-23](docs/production-release.md).
Rules for everybody who works on this repository, people and agents: [AGENTS.md](AGENTS.md).

**State of V2:** developed on the branch `v2/platform`, verified locally, open as pull request #6.
Its migrations are not applied to production. Applying them, merging to `main` and deploying are
decisions of the owner, in this order.

## Local setup

```sh
npm ci
supabase start
```

Docker is required. The checked-in local configuration uses project `pwanova-beta-local`, API port **55321**, Postgres **55322**, Studio **55323**, and local email inbox **55324**. It does not link to a remote project. Copy `.env.example` to ignored `.env.local` and fill **local** API/anon/service keys from your local Supabase instance. Keep `NEXT_PUBLIC_SITE_URL=http://localhost:3000`, `DEMO_MODE=false`, `SHOW_DEMO_DATA=false`. Then `npm run dev`.

Sign in via email magic link; local messages are captured by the local inbox, not sent to real recipients. Enable Google/GitHub buttons only after configuring those providers and setting their `NEXT_PUBLIC_AUTH_*` flags. `/auth/callback` must be in Supabase's allowed redirect URLs. Administrators must be provisioned explicitly by a trusted database operator; no first-user admin behavior exists.

For a read-only, fabricated development demonstration without Supabase, use `DEMO_MODE=true`. Production with missing credentials does **not** invent a backend or catalog. Seeded `is_demo` data stays out of normal catalog, direct app pages, search, API, embeds and dashboards. `/partners/demo` and `_example` are explicit fictional integration examples, never real partners or real analytics.

## Core flows

Every page lives under a language, `/en/...` or `/de/...`. The addresses of version 1 redirect.

- **Visitor:** `/discover` (search, filters, sorting) → a listing with its trust snapshot → the
  evidence page → `/compare/a-vs-b` for up to four apps → the product's site or the install guidance
  (`#install`). Nothing needs an account, and a visit stores nothing on the device.
- **Member:** save, follow, rate, review, keep comparisons, get notifications in the app.
- **Buyer:** `/requests/new` describes what is needed; a short list of at most five products says for
  every requirement how it is documented. Vendors see the requirements, never the person. Contact
  details are shared per vendor, field by field, by a consent that can be withdrawn.
- **Maker:** `/submit` → the listing waits for review → `/apps/{slug}/claim` proves control of the
  domain → `/dashboard/apps/{slug}`: profile, statements with a source, pricing, data locations,
  subprocessors, AI providers, updates, launches. What is entered before ownership is proven waits
  for review and is not shown.
- **Moderator and admin:** `/admin`: queue, reports, listings, evidence, requests, plans, settings,
  audit log. Every decision needs a reason and leaves a record.
- One rating per person and app. Deleting the text of a review keeps the rating; removing the
  rating keeps the text. Owners cannot rate their own apps.
- Guest review drafts are kept for 24 hours and survive signing in. They are never posted
  automatically.

### Three answers, and where they come from

Every fact is **yes**, **no** or **unknown**. Unknown is shown as "Not verified" and is never
filtered, compared or exported as no. Every answer names its origin: "Checked by PWANova",
"Reviewed by PWANova" or "Stated by the vendor". No page states that a product is compliant,
certified, safe or guaranteed.

### Ranking

The organic order uses evidence completeness, engagement, profile completeness, a weighted rating
and the freshness of the evidence. Nothing paid is part of it. Sponsored placements are separate,
labelled ("Sponsored" / "Anzeige") and switched off by default. The formula is published on
`/how-ranking-works`.

## Ownership, identity and checks

The beta offers one method: `https://<exact-app-origin>/.well-known/pwanova-verification.txt`, containing the issued token only. Tokens use two random UUIDs, expire in three days, and bind user, app and current URL. Restart rotates the token. Verification accepts no redirects. Finalization locks the app and claim, compares token/URL/expiry/status, and cannot replace a verified owner. DNS/meta/provider methods are unavailable for the beta.

Canonical identity is **exact origin + case-sensitive pathname**, ignoring query/fragment and normalizing trailing slashes. `a.vercel.app` and `b.vercel.app` remain separate. `/one` and `/two` on the same origin can be separate apps. Query-only app identities are not supported by this beta; use distinct stable paths. The origin's controller can verify multiple path-based apps; path isolation does not prove separate infrastructure ownership. The database uniqueness index prevents duplicate canonical URLs, including competing submissions. Existing conflicts cause migration failure for manual resolution, not silent merges or data deletion.

Changing the app URL resets ownership, technical observations and publication approval, and expires outstanding claims. Scanner results commit only if the URL still matches. Public labels separate **Ownership verified**, URL reachability, HTTPS and manifest observations. Browser installation, responsive behavior, service worker activation, offline, push and security auditing remain **Unknown** unless independently tested. HTTPS and manifest detection are not safety/installability guarantees.

All untrusted HTTP requests (metadata, manifest, ownership and raster-image proxy) use scheme/default-port checks, IPv4/IPv6 restrictions, connection-time DNS validation, redirect validation, a shared deadline, and byte caps. No user cookies/internal credentials are forwarded; no remote code runs. Raster media excludes SVG/HTML and uses `nosniff`. Private/local addresses remain blocked even during development.

## Public API and Partner Kit

Version 1 of the public API is read-only, public data only, CORS enabled, 60 requests a minute:

```text
GET /api/v1/apps?q=&category=&fact=&language=&eu=1&sort=&page=&lang=
GET /api/v1/apps/<slug>
GET /api/v1/apps/<slug>/evidence
GET /api/v1/apps/by-domain?domain=app.example
GET /api/v1/categories
GET /api/v1/facts
```

`lang` selects the language of the answer, `language` filters by the languages an app is available
in. A fact that is missing from a response is unknown; `rating` is `null` when nobody has rated.
Responses may be cached for five minutes.

The endpoints of the partner kit are unchanged:

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

Partner attribution travels in the address (`?ref=<code>`); no cookie is set for it. Public client events are deduplicated per app, type and IP bucket (views for 30 minutes) and rate-limited in Postgres. IPs are daily server-keyed hashes in temporary rate-limit keys, not raw event fields; counters expire after a day. This is spam reduction, not unique-user measurement. Production fails closed when shared rate limiting is unavailable. Run behind a trusted proxy that overwrites forwarding headers (the intended deployment is Vercel).

Raw events have a **180-day retention helper** (`purge_old_events`, used by the authenticated maintenance route). The existing `vercel.json` declares daily maintenance; confirm `CRON_SECRET` and actual execution in the authorized deployment. No production scheduler was changed by this task. Private dashboard/API/auth responses are never service-worker cached; v2 invalidates old local caches and retains only static assets plus the offline page.

## Commands

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run validate          # the four above, in this order
npm run verify:supabase   # checks of version 1 against the local stack
npx playwright install chromium
npm run test:e2e
npm run db:types          # regenerate src/lib/database.types.ts from the local database
```

`npm test` uses the Node test runner and PGlite (Postgres in process): schema from scratch, upgrade
of a database with data, row level security, evidence rules, search, matching, the verification
engine without a network. `verify:supabase` and the end-to-end tests use the local stack with the
real sign-in, API and storage services, create their own fixtures and refuse any other target.
Browser traces are disabled so that reports keep no credentials. No test runner may be pointed at
production.

Migrations are additive files in `supabase/migrations/`. The eleven V2 migrations
(`20260929100000` to `20260929101000`) are described in [migration](docs/PWANOVA_V2_MIGRATION.md).
Production operations need the owner's explicit approval, one action at a time; see
[AGENTS.md](AGENTS.md) and [deployment](docs/PWANOVA_V2_DEPLOYMENT.md).
