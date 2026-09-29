# PWANova V2 — database migration

Eleven migrations turn the database of version 1 into the database of V2. All of them are
additive: no table, column, row, id or slug is dropped, renamed or rewritten.

**State at the time of writing: the migrations are applied to the local database only. Production
is at `20260922222344`.** Applying them to production is a decision of the owner and a separate,
explicit step ([deployment](PWANOVA_V2_DEPLOYMENT.md)).

## 1. The migrations, in order

| Version | File | What it adds |
| --- | --- | --- |
| `20260929100000` | `v2_foundation` | extensions `pg_trgm` and `unaccent`; role `moderator`; `profiles.locale`; categories, use cases, companies, translations, platforms, languages, integrations, pricing plans, data locations, subprocessors, AI providers; new columns on `apps`; mapping of existing listings to the new categories |
| `20260929100100` | `v2_evidence` | fact registry (31 facts), evidence, verification runs and results, current facts, scores; what version 1 had observed becomes evidence with its original date |
| `20260929100200` | `v2_engagement` | follows, category follows, updates, notifications, comparisons, alternatives; `reviews.status`; more event types |
| `20260929100300` | `v2_launches` | launches and the view `launch_board` |
| `20260929100400` | `v2_buyer_requests` | requests, contacts, matches, responses, consents, and the functions that share and withdraw contact details |
| `20260929100500` | `v2_platform` | settings, plans, entitlements, sponsor campaigns, newsletter subscriptions, audit log, moderator and admin functions; more report reasons and targets |
| `20260929100600` | `v2_search_catalog` | search documents and triggers, the view `catalog_apps`, `search_catalog`, `popular_apps`, `duplicate_target`; search documents for existing listings |
| `20260929100700` | `v2_owner_statements` | entries made before ownership was proven become vendor statements when it is proven |
| `20260929100800` | `v2_entitlement_guard` | the database refuses a response to a buyer request without a plan, once monetisation is enforced |
| `20260929100900` | `v2_admin_audit` | changes of settings, sponsor campaigns and roles are written to the audit log |
| `20260929101000` | `v2_unreviewed_rows` | entries without proven ownership are readable by their author, the managers of the listing and moderators only |

The two files `20260922204132_deployment_hardening.sql` and
`20260922204432_restrict_business_grants.sql` are empty placeholders for versions that belong to
the other application in the shared project. They were adopted with version 1 and are not changed.

## 2. What happens to existing data

| Existing data | Effect |
| --- | --- |
| Listings (`apps`) | unchanged. Each gets `primary_category_id` from its `category` (all 16 slugs of version 1 have a V2 category), the platform "web", and "pwa" where a manifest had been observed |
| `apps.category` | stays, and stays in use by old writers. A trigger gives new rows their V2 category |
| Ratings, reviews, helpful votes, responses, saves | unchanged. `reviews.status` is filled from `hidden_at` and kept in step with it in both directions |
| Checks of version 1 (`app_checks`) | reachability, HTTPS and the manifest become evidence of origin `pwanova_observed` with the date of the original check. Nothing else is derived |
| Trust facts nobody checked | get no row. They are unknown, not no |
| Vendor statements | none is invented |
| Ownership, claims | unchanged |
| Reports | unchanged; new reasons and targets are allowed in addition |
| Partners, referrals, events | unchanged; three event types are allowed in addition |
| Users (`auth.users`, `profiles`) | unchanged; `profiles.locale` is empty until a person picks a language |
| Scores | `evidence_score`, `profile_completeness`, `verification_state` and the search document are computed for every listing |

Objects of the other application (`public.business_*`, its users, its migration versions) are
neither read nor written. No migration iterates over "all tables" or "all functions" of the schema.

### Changed constraints

Five check constraints are replaced by wider ones, so existing rows stay valid:
`profiles_role_check` (adds `moderator`), `app_events_event_type_check` (adds three types),
`app_claims_status_check` (adds `rejected` and `revoked`), `reports_reason_check` (adds reasons) and
the target check of `reports` (a report may also name an evidence entry, a launch or a request).

### Replaced functions and policies

Five functions of version 1 are replaced by versions that know the new columns and the moderator
role: `protect_app`, `protect_report_status`, `protect_review_moderation`, `moderate`,
`lock_engagement_identity`. The policy `reviews_read` is replaced: a review is public when it is not
hidden and its status is `published`; moderators read all reviews. Eight read policies of V2 itself
are narrowed by the last migration.

The database tests of version 1 (`tests/db.test.ts`, 50 tests) run against the fully migrated
schema and pass.

## 3. How this was verified

| Check | Command | Result (2026-09-30) |
| --- | --- | --- |
| Upgrade of a database with data: counts, ids, slugs, owners, reviews and ratings identical before and after; every listing has a category and a search document; only observed facts exist | `node --conditions=react-server --import tsx --test tests/upgrade.test.ts` | 2 of 2 passed |
| Rules of the new schema | `tests/v2-db.test.ts`, `tests/v2-owner.test.ts` | 38 of 38, 14 of 14 passed |
| Rules of version 1 on the new schema | `tests/db.test.ts` | 50 of 50 passed |
| All migrations on the local Supabase stack (Postgres 17), from an empty database | `supabase db reset` (local) | see the final report of the release |
| Generated types compile against the application | `npm run db:types && npm run typecheck` | passed |

The tests run on PGlite (Postgres in process). The local Supabase stack is the second, independent
check with the real extensions and the real auth schema.

## 4. Before applying to production

To be done by the owner, in this order. Steps 1 to 3 only read.

1. `supabase migration list --linked`: production shows the versions up to `20260922222344`, the
   eleven V2 versions are local only, and nothing else differs.
2. Take a backup: a dump into a private directory with owner-only permissions (`supabase db dump`
   is itself a production operation that the owner starts), or a backup from the dashboard where the
   plan offers one. There is no down migration; the backup is the way back for data.
3. Check that no listing has a `category` outside the 16 known slugs:
   `select category, count(*) from public.apps group by 1;` Such a listing would keep its value and
   get no V2 category until one is chosen in the dashboard.
4. Apply: `supabase db push`, without `--include-seed`: the seed files contain sample listings for
   local development and do not belong in production. The migrations run in order. A failure stops the push; migrations
   that completed before it stay applied, and the push can be repeated after the cause is fixed.
5. Check: `supabase migration list --linked` shows all versions on both sides.
6. Deploy the application ([deployment](PWANOVA_V2_DEPLOYMENT.md)).

### Expected duration and locks

The catalogue is small (tens of listings). Every migration finishes in seconds. `alter table apps
add column` takes a short exclusive lock on `apps`; the backfills touch every listing once.

## 5. Order of database and application

The schema comes first. Version 1 of the application works on the migrated database: its tables,
columns, views and functions are all still there, and its writers are kept working by triggers
(`apps_v2_defaults`). The V2 application does not work on the old schema.

So: apply the migrations, check the running version-1 site, then deploy V2.

## 6. Way back

- **Application:** promote the previous deployment in Vercel. It runs on the migrated schema.
- **Features:** `site_settings.features` switches compare, launches, requests, newsletter and
  sponsorship off without a deployment.
- **Schema:** there is no down migration, on purpose. The new tables can stay unused. Removing them
  would be a new, reviewed migration and is not needed for going back.
- **Data:** restore the backup of step 2 only if data was damaged. A restore also removes what
  users did after the backup, and it affects the other application in the shared project. It is the
  last resort and needs the owner's decision.

## 7. Rules for later migrations

- Additive files in `supabase/migrations/`, applied by the owner after review.
- Applied history is never rewritten, versions are never renumbered, and no placeholder is added
  to make numbers match.
- A new fact is a row in `fact_attributes`. A new language needs no schema change.
- After a schema change: `npm run db:types`, `npm run typecheck`, `npm test`.
