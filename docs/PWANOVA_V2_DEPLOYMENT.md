# PWANova V2 — deployment

V2 is developed on the branch `v2/platform` and verified locally. It uses the existing repository,
the existing Supabase project and the existing Vercel project. No account, project, domain or paid
service is added.

**Every step marked "owner" changes production and needs the owner's explicit yes for that one
step, in the conversation in which it is done** (`AGENTS.md`). Nothing in this document is an
approval.

## 1. Where things stand

| Item | State |
| --- | --- |
| Code | branch `v2/platform`, local commits, not pushed |
| Database migrations | applied to the local database only; production is at `20260922222344` |
| Production site | version 1, unchanged |
| Environment variables | unchanged; V2 adds none |

## 2. Requirements

| What | Value |
| --- | --- |
| Node.js | 20 or newer (as in CI) |
| Supabase CLI | 2.x, for the local stack and for `db push` |
| Docker | for the local stack |
| Vercel | existing project, region `fra1`, one daily cron job |

### Environment variables (names only)

| Name | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Vercel | canonical addresses, sitemap, sign-in return address |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel | database and sign-in |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel, server only | verification runs, events, rate limits, ownership |
| `CRON_SECRET` | Vercel | protects `/api/cron/*` |
| `NEXT_PUBLIC_AUTH_GITHUB`, `NEXT_PUBLIC_AUTH_GOOGLE` | Vercel | show a sign-in button for a provider that is configured in Supabase |
| `ALLOW_INDEXING` | Vercel | `true` opens the site to search engines |
| `DEMO_MODE`, `SHOW_DEMO_DATA` | never in production | sample listings for demonstrations |
| `ALLOW_PRODUCTION_TARGET` | a single command | lets a writing script target the cloud project for one run |

Without `SUPABASE_SERVICE_ROLE_KEY` the site works, but no verification runs are recorded, events
are not counted and rate limits are not shared between instances.

## 3. Local verification (no production access)

```bash
npm ci
```

```bash
supabase start
```

```bash
npm run validate
```

```bash
npx playwright test
```

`npm run validate` runs the type check, the linter, the unit and database tests and the production
build. The end-to-end tests refuse any target but the local stack (`playwright.config.ts`).
`npm run verify:supabase` runs the checks of version 1 against the local stack with the real
sign-in, API and storage services.

Results of the last run: [report](PWANOVA_V2_REPORT.md).

## 4. Release steps

| # | Step | Who | Changes production |
| --- | --- | --- | --- |
| 1 | Review the branch: `git log main..v2/platform`, `git diff main...v2/platform --stat` | owner | no |
| 2 | Push the branch and open a pull request | owner approves the push | no (a branch, not `main`) |
| 3 | CI on the pull request: type check, lint, tests, build | automatic | no |
| 4 | Read-only comparison of migrations: `supabase migration list --linked` | owner | no |
| 5 | Backup of the production database | owner | no |
| 6 | Apply the migrations: `supabase db push` | **owner** | **yes** |
| 7 | Check version 1, which is still deployed, against the migrated database: start page, a listing, sign-in, a rating | owner | no |
| 8 | Merge the pull request into `main`. A push to `main` deploys | **owner** | **yes** |
| 9 | Checks after the deployment (section 6) | owner | no |
| 10 | Enter the operator's details (section 7) | **owner** | yes |
| 11 | Open the site to search engines when it is ready: `ALLOW_INDEXING=true` | **owner** | yes |

The order of steps 6 and 8 matters: version 1 works on the migrated database, V2 does not work on
the old one. Details: [migration](PWANOVA_V2_MIGRATION.md).

If a preview deployment of the branch is wanted before step 6, it needs its own database. The
preview must not point at the production database before the migrations are applied there, and no
new Supabase project or branch is created without the owner's decision.

## 5. Settings outside the repository

| Setting | Where | Needed value | Change needed |
| --- | --- | --- | --- |
| Sign-in return addresses | Supabase → Authentication → URL configuration | `<site>/auth/callback`, exactly | no, it is already listed. V2 sends exactly this address |
| Site URL | same place | the public address of the site | no |
| Cron | `vercel.json` | `/api/cron/health`, daily at 04:00 UTC | no. The job now also runs the verification that is due |
| Function duration | Vercel | the cron route asks for 60 seconds | check that the plan allows it |
| E-mail sender | Supabase → Authentication → SMTP | the project's setting | no change by V2 |

`supabase config push` is not part of this release.

## 6. Checks after the deployment

Reading only, in a private window:

1. `/` redirects to `/en` or `/de`; no cookie is set.
2. `/explore`, `/top`, `/ship`, `/categories/fitness` arrive at their new addresses.
3. `/en/discover`: listings, filters with counts, sorting. `/de/discover`: the same in German.
4. A listing: trust snapshot with "Not verified" where nothing is known; the evidence page.
5. `/en/compare/<a>-vs-<b>` for two real listings.
6. `/en/verification-methodology`, `/en/how-ranking-works`, `/en/legal/privacy`.
7. `/api/v1/apps`, `/api/v1/facts`, `/api/public/apps/by-domain?domain=<a listed domain>`,
   `/api/badge/<slug>`, `/embed/app/<slug>`.
8. `/sitemap.xml` lists both languages; `/robots.txt` matches `ALLOW_INDEXING`.
9. Sign in with a magic link; the link returns to `/auth/callback` and continues to the page asked for.
10. The logs of the deployment show no error.

Then, signed in as admin: Admin → Queue, Evidence, Settings open without error; start one manual
verification run for one real listing and read its results on the evidence page.

The daily job runs at 04:00 UTC. The day after, the evidence pages of the first ten listings show
results with the origin "Checked by PWANova".

## 7. After the release, by the owner

| Task | Where | Why |
| --- | --- | --- |
| Operator: name, address, e-mail, phone, representative, register, VAT number, person responsible for the content, as far as they apply | Admin → Settings → Operator details | the imprint and the privacy page show "not entered yet" and stay out of search engines until then |
| Have imprint, privacy policy and terms checked by a lawyer | — | they are templates |
| Data processing agreements with Vercel and Supabase, region of the database | privacy page, section "Processors" | marked as open in the text |
| Give the role `moderator` | Admin → Settings → Moderators | moderators review evidence, launches, requests, reviews and reports |
| Give the role `admin` | in the database (`profiles.role`) | there is no first-user admin, and the admin area does not create admins |
| Decide on feature switches | Admin → Settings → Features | sponsorship is off; compare, launches, requests and newsletter are on |
| Keep `monetization.enforced` off until a payment process exists | row `monetization` of `site_settings`, changed in the database; the admin area has no switch for it | plans are announced, not orderable |
| Newsletter: choose a sending service before the first issue | — | addresses and consents are stored, nothing is sent |

## 8. Way back

| Problem | Action |
| --- | --- |
| The new version misbehaves | promote the previous deployment in Vercel. It runs on the migrated database |
| One feature misbehaves | switch it off in Admin → Settings → Features |
| Verification runs cause load or complaints | set `daily_budget` to 0 in the row `verification` of `site_settings` (in the database) |
| Data was damaged | restore the backup of step 5. This also affects the other application in the shared project and needs the owner's decision |

## 9. What this release does not include

- a payment provider, invoices, or ordering of plans;
- sending of newsletters or e-mail notifications (notifications are shown in the app);
- languages other than English and German;
- a content security policy for pages;
- an external security audit;
- separation of the two applications that share the Supabase project.
