# PWANova V2 — implementation report

Date: 2026-09-30. Branch `v2/platform` on top of `main` (`cac752c`). The results below were
produced on commit `4b04af1`; this report was added after it.
**The branch is pushed and open as pull request #6 (draft). Production runs version 1 and was
not touched; the migrations are not applied there.**

Every result below was produced by a command that was actually run on that date. Where something
was not run or not measured, it says so.

## 1. Implemented

| Area | What exists |
| --- | --- |
| Languages | every page under `/en` and `/de`; language switcher; `hreflang`, canonical addresses; localized sitemap; typed dictionaries |
| Discover | `/discover` with search, filters in the address, six sort orders, pagination; sidebar on wide screens, bottom sheet on phones; categories (24), collections (saved filters) |
| Trust | fact registry (31 facts), evidence history, separate layers for what PWANova verified and what the vendor states; trust snapshot on the listing; evidence page with history; three states everywhere |
| Verification | engine that checks a product's public website (18 facts), guarded requests, robots.txt, limits, scheduled and requested runs, manual review by moderators |
| Compare | up to four apps, one canonical address, saved comparisons; alternatives pages |
| Launches | submitted by the verified owner, approved by a moderator, 30-day window, no vote counter |
| Buyer requests | `/requests/new`, deterministic short list of at most five, contact details in a separate table, consent per vendor and field, withdrawal |
| Accounts | follows of apps and categories, notifications in the app, saved apps, profile with language, newsletter consent |
| Reviews | unchanged behaviour of version 1; review states for moderation |
| Maker dashboard | listing, profile completeness, statements with a source, pricing, data locations, subprocessors, AI providers, updates, launches, plan, re-check |
| Admin | queue, reports, listings, evidence, requests, plans and entitlements, settings, sponsor campaigns, moderators, audit log |
| Monetization | plans and entitlements in the database, enforced by the database when switched on; no payment provider |
| Public API | `/api/v1/*`, read-only; version-1 endpoint, badge and embed unchanged |
| Legal and transparency | imprint, privacy, terms (templates that mark missing operator data), verification methodology, ranking, sponsorship, review rules |
| SEO | structured data without invented ratings or prices; `noindex` for private, filtered and thin pages |
| Privacy | nothing stored on a visit; partner attribution without a cookie; events without IP addresses |
| Documentation | audit, architecture, data model, verification, security, migration, redirects, deployment, this report |

## 2. Database

- Eleven additive migrations, `20260929100000` to `20260929101000`: 38 new tables, 2 new views,
  new columns on `apps`, `profiles`, `reviews`, `reports`. Nothing dropped or renamed.
- Row level security on all 56 tables of the application.
- Applied to the **local** database only. `supabase db reset --local` applied all 19 migration
  files of the repository from an empty database, followed by both seed files, without error.
- Generated types: `src/lib/database.types.ts` (`npm run db:types`).

Details: [data model](PWANOVA_V2_DATA_MODEL.md), [migration](PWANOVA_V2_MIGRATION.md).

## 3. Existing data

Production data was neither read nor written during this work. What the migrations will do to it
when the owner applies them:

- listings, ratings, reviews, saves, ownership, claims, partners, events and users stay as they are;
- every listing gets its V2 category from its version-1 category (all 16 slugs are mapped), the
  platform "web", and "pwa" where a manifest had been observed;
- reachability, HTTPS and the manifest, which version 1 had observed, become evidence with the date
  of the original check;
- every other fact starts as unknown. No vendor statement and no answer is invented;
- objects of the other application in the shared Supabase project are not touched.

Shown by `tests/upgrade.test.ts` on a database with data: counts, ids, slugs, owners, reviews and
ratings are identical before and after.

## 4. Security

- The database decides: policies, triggers and functions enforce origin of a statement, ownership,
  roles, entitlements and the privacy of buyer contacts, whatever a client sends.
- Found and fixed during the review for this report: rows entered without proven ownership were
  hidden by the pages but readable through the database API. Migration `20260929101000` narrows
  eight read policies; covered by tests.
- Guarded requests to other sites, rate limits in the database, validated input, same-origin return
  addresses, escaped structured data, audit log for every moderator and admin decision.
- No new environment variable, no secret in the repository, no secret printed.

Open points are listed in [security, section 14](PWANOVA_V2_SECURITY.md): no content security
policy for pages yet, Supabase advisor not run for V2 (it is not in production), no external audit.

## 5. Verification

What is checked, how, and what is not concluded: [verification](PWANOVA_V2_VERIFICATION.md).
"No link found" never becomes a no, "could not check" changes nothing, a vendor statement never
overwrites a verified result, history is kept. No page and no API field states compliance,
certification, safety or a guarantee.

The engine was tested without a network (fake sites). It has not been run against real product
websites from production, because V2 is not deployed.

## 6. Routes

Pages, each under `/en` and `/de`:

`/`, `/discover`, `/categories`, `/categories/[slug]`, `/collections`, `/collections/[slug]`,
`/alternatives/[slug]`, `/compare`, `/compare/[key]`, `/apps/[slug]`, `/apps/[slug]/evidence`,
`/apps/[slug]/claim`, `/launches`, `/launches/[slug]`, `/requests`, `/requests/new`,
`/requests/[id]`, `/submit`, `/dashboard`, `/dashboard/apps/[slug]`, `/dashboard/requests`,
`/saved`, `/notifications`, `/profile`, `/sign-in`, `/developers/[username]`, `/for-makers`,
`/pricing`, `/partners`, `/partners/demo`, `/review-rules`, `/verification-methodology`,
`/how-ranking-works`, `/sponsorship`, `/legal/imprint`, `/legal/privacy`, `/legal/terms`, `/admin`.

Without a language: `/api/v1/apps`, `/api/v1/apps/[slug]`, `/api/v1/apps/[slug]/evidence`,
`/api/v1/apps/by-domain`, `/api/v1/categories`, `/api/v1/facts`, `/api/public/apps/by-domain`,
`/api/badge/[slug]`, `/api/events`, `/api/media`, `/api/cron/health`, `/api/cron/verify`,
`/auth/callback`, `/auth/sign-out`, `/embed/app/[slug]`, `/offline`, `/robots.txt`,
`/sitemap.xml`, `/manifest.webmanifest`.

Every address of version 1 answers or redirects: [redirects](PWANOVA_V2_REDIRECTS.md).

## 7. Monetization

Seven plans are stored with prices in the database (one free, six announced). None can be ordered:
no payment provider is connected, and an admin grants an entitlement. `monetization.enforced` is
off, so nothing is paywalled. No plan contains ranking, search position or a trust label.
Sponsorship is switched off; when switched on, placements are separate and labelled.

## 8. Tests

All commands were run in the root of the repository on commit `4b04af1` unless noted.

| Command | Result |
| --- | --- |
| `npm run validate` | exit 0 |
| — `npm run typecheck` (`next typegen && tsc --noEmit`) | no errors |
| — `npm run lint` (`eslint`) | no errors, no warnings |
| — `npm test` | 240 tests, 240 passed, 0 failed, 0 skipped |
| — `npm run build` | compiled; 73 of 73 static pages generated |
| `npm run verify:supabase` (local stack) | 39 of 39 checks passed |
| `npx playwright test` (development server started by the configuration) | 16 of 16 passed |
| `npx playwright test` against the production build (`npm run start`, local stack) | 16 of 16 passed |
| Clean checkout (`git worktree`), `npm ci`, then type check, lint, tests, build | all passed; 240 of 240 tests |
| `supabase db reset --local` | all migrations and both seeds applied |

Tests per file (`npm test`):

| File | Tests |
| --- | --- |
| `tests/db.test.ts` (version 1 rules on the V2 schema) | 50 |
| `tests/lib.test.ts` | 45 |
| `tests/v2-unit.test.ts` | 49 |
| `tests/v2-db.test.ts` | 38 |
| `tests/v2-verify.test.ts` | 23 |
| `tests/v2-owner.test.ts` | 14 |
| `tests/ssrf.test.ts` | 9 |
| `tests/reviews.test.ts` | 4 |
| `tests/install-dialog.test.ts` | 3 |
| `tests/upgrade.test.ts` | 2 |
| `tests/production-mode.test.ts` | 2 |
| `tests/service-worker.test.ts` | 1 |

End-to-end journeys (`tests/e2e/v2.spec.ts`): languages and old addresses; nothing stored on a
visit; three states and origins; evidence history; compare with two and four apps; guest review
draft; owner response, update and notification; editing and removing a review and a rating;
submission, duplicates and approval; launch; buyer request with consent and withdrawal; public API;
search engines; narrow screens; sign-up by e-mail; partner link without a cookie.

Layout, checked with a script that loads pages in Chromium and reports what sticks out:

| Widths | Pages | Result |
| --- | --- | --- |
| 320, 360, 375, 414 px | 49 public pages in both languages (392 page loads) | no sideways scrolling |
| 768, 1280 px | 49 public pages in German (98 page loads) | no sideways scrolling |
| 320 px, signed in as owner; 375 px, signed in as admin | dashboard with all tabs, requests, saved, notifications, profile; admin with all tabs | no sideways scrolling (part of the end-to-end test) |

Defects that the tests found and that were fixed before this report: a language parameter of the
API that was also read as a filter; tables, long German headings, button labels and the catalogue
layout wider than a phone screen; filter checkboxes without an accessible name because two panels
shared ids; a comparison of four apps that lost the fourth; a type check that failed on a fresh
checkout.

### Not tested

- Production. No command of this work was pointed at the production database or deployment.
- Real phones and tablets; only Chromium with emulated widths.
- Delivery of real e-mail; the local inbox was used.
- Sign-in with GitHub or Google.
- Performance (no Lighthouse run, no load test).
- Accessibility beyond what the tests touch: names of controls, roles, keyboard-reachable dialogs.
  No audit with assistive technology.
- Browsers other than Chromium.

## 9. Environment

No environment variable was added, removed or renamed. Names and purposes:
[deployment, section 2](PWANOVA_V2_DEPLOYMENT.md). The local `.env.local` points at the local
stack. The sign-in return address registered with Supabase (`<site>/auth/callback`) is already in
the allow-list; V2 sends exactly that address.

## 10. Manual actions for the owner

Each production action needs its own explicit approval.

| # | Action |
| --- | --- |
| 1 | Review pull request #6 (the branch was pushed and the pull request opened on 2026-09-30 with the owner's approval) |
| 2 | Back up the production database |
| 3 | Apply the migrations (`supabase db push`, without `--include-seed`) |
| 4 | Check the running version-1 site on the migrated database |
| 5 | Mark the pull request as ready and merge to `main`, which deploys |
| 6 | Run the checks after the deployment ([deployment, section 6](PWANOVA_V2_DEPLOYMENT.md)) |
| 7 | Enter the operator's details in Admin → Settings; have the legal texts checked by a lawyer |
| 8 | Name the processors' agreements and the region of the database on the privacy page |
| 9 | Appoint moderators; decide on feature switches |
| 10 | Set `ALLOW_INDEXING=true` when the site is ready for search engines |
| 11 | Decide what happens to `docs/security/secrets-and-access-plan.md`, a local file of the earlier security task that is not part of any commit |

## 11. Remaining limitations

| Limitation | Consequence |
| --- | --- |
| The admin area is English only | moderators need English |
| Counts next to filters are counts of the whole catalogue | they do not shrink when other filters are selected |
| Verification reads the start page and the documents it links | documents linked from deeper pages, and navigation that exists only after scripts ran, are not found; the vendor can state them |
| PDFs are not read | they count only when name and address are unambiguous |
| `open_source`, EU hosting, training on customer data, SSO and similar facts are never concluded automatically | they stay unknown until stated by the vendor or reviewed |
| Ten scheduled verification runs a day | with many listings the interval between checks grows; the age of every answer is shown |
| Publishing a listing does not start a run | a new listing is checked by the next daily job or by a manual run |
| No payment provider | plans are announced, entitlements are granted by an admin |
| Newsletter addresses and consents are stored, nothing is sent | a sending service has to be chosen and named on the privacy page first |
| Notifications exist in the app only | no e-mail notifications |
| Imprint, privacy and terms are templates | they are marked as such and not indexed until operator data is entered |
| No content security policy for pages | planned, needs nonces for two inline scripts |
| Search has no synonyms and knows English and German word forms | other languages match by exact words and similar spelling |
| Launch order and "popular" lists need engagement of signed-in people | with little traffic the lists are short or hidden; nothing is filled in |
| The Supabase project is shared with another application | every migration names its objects; a restore of a backup would affect both |
| Sample listings exist in the local seed only | production shows real listings only; most of their facts start as unknown |
