# PWANova V2 — database migration

Eleven migrations turn the database of version 1 into the database of V2. All of them are
additive: no table, column, row, id or slug is dropped, renamed or rewritten.

**State at the time of writing: the migrations are applied to the local database only. Production
is at `20260922222344`.** Applying them to production is a decision of the owner and a separate,
explicit step ([deployment](PWANOVA_V2_DEPLOYMENT.md)). `supabase db push` cannot be used for it;
section 4 says why and what is used instead.

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
| All migrations on the local Supabase stack (Postgres 17), from an empty database | `supabase db reset --local` | all 19 migration files and both seed files applied |
| Generated types compile against the application | `npm run db:types && npm run typecheck` | passed |

The tests run on PGlite (Postgres in process). The local Supabase stack is the second, independent
check with the real extensions and the real auth schema.

## 4. Production as it is (read on 2026-09-30, without writing)

Read through the project's read-only connection. Nothing was changed.

| Item | State |
| --- | --- |
| PostgreSQL | 17.6 |
| Extensions `pg_trgm`, `unaccent` | available, not installed yet; the first migration installs them into `extensions` |
| Listings | 27: 26 published, 1 waiting for review; no sample data |
| Categories of the listings | 10 different slugs, all of them among the 16 that V2 maps |
| Ownership | 3 listings have a submitter, none has verified ownership; 3 claims are pending |
| Checks of version 1 | 27 rows: 27 reachable, 27 over HTTPS, 14 with a manifest. They become the first evidence |
| Ratings, reviews, saves, reports | none |
| Profiles | 2, one of them admin |
| Names that V2 creates (38 tables, 2 views, 18 columns on `apps`) | none exists yet: no collision |
| The other application | its tables and functions all begin with `business_`; none of them uses a function, table or policy of PWANova; its only shared dependency is `auth.users` |
| Migration history | the eight versions of this repository **and one version of the other application, `20260924184739`**, which has no file here |

### The Supabase CLI cannot apply these migrations

`supabase db push` and `supabase migration up` compare the history of the database with the files
of the repository and stop when the history holds a version without a file:

```text
Remote migration versions not found in local migrations directory.
… try repairing the migration history table:
supabase migration repair --status reverted 20260924184739
```

`--include-all` does not change this. Reproduced on the local database with the same history as
production, with both commands.

Both ways out that the CLI offers are closed:

| Way | Why not |
| --- | --- |
| mark `20260924184739` as reverted | it is the migration of another application and it is applied; the history would say something false |
| add an empty file with that version | a placeholder says nothing about what ran; the rules of this repository forbid new ones |

This is a consequence of two applications recording their migrations in one table. It will meet
the other application as well: once the eleven versions of V2 are recorded, its CLI finds eleven
versions without a file. Giving each application its own project ends this; that is a decision of
the owner and not part of this release.

### `scripts/apply-migrations.sh`

Does what `supabase db push` does, and leaves versions alone that are not from this repository:

1. reads the history of the target and the files in `supabase/migrations/`;
2. lists the versions that are foreign, and the files that are pending, in order;
3. stops if a pending file is older than a version of this repository that is applied already;
4. applies each pending file in one transaction together with its row in
   `supabase_migrations.schema_migrations` (version, name, the statements);
5. stops at the first failure; the failed migration is rolled back, earlier ones stay applied.

It refuses every target except the local stack unless `ALLOW_PRODUCTION_TARGET` names the project,
takes the connection from the environment (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`,
`PGDATABASE`), never prints the password and never passes it as an argument. It uses `psql` from
the database container of the local stack, so nothing has to be installed. `--dry-run` prints the
plan and changes nothing.

### Rehearsal (2026-09-30, local stack, PostgreSQL 17)

| Step | Command | Result |
| --- | --- | --- |
| Database of version 1 with data | `supabase db reset --local --version 20260922222344 --sql-paths ./seed.sql` | 18 tables, 15 listings, 30 reviews, 490 ratings, 431 saves, 70 users |
| History as in production | one row `20260924184739` inserted into the local history | 9 versions |
| The CLI | `supabase db push --local --dry-run`, `supabase migration up --local`, each also with `--include-all` | refused, with the message above |
| Plan | `scripts/apply-migrations.sh --local --dry-run` | 8 applied, 1 foreign and left alone, 11 to apply |
| Apply | `scripts/apply-migrations.sh --local` | 11 applied, 20 versions in the history, the foreign row untouched |
| Data | counts, and checksums over ids, slugs, owners, categories, states and addresses of all listings and over all reviews, before and after | identical |
| Upgrade | categories and search documents | 15 of 15 listings |
| Facts | `app_facts` | only `https`, `pwa_manifest`, `website_reachable`; no vendor statement |
| Second run | `scripts/apply-migrations.sh --local` | nothing to apply |
| Checks of version 1 | `npm run verify:supabase` | 39 of 39 |
| End-to-end tests | `npx playwright test` | 16 of 16 |
| Schema | `pg_dump --schema-only --schema=public` of this database and of one built by `supabase db reset --local` | identical, 4071 lines each |

## 4a. Applying to production

To be done by the owner, or with the owner's explicit approval for each step that writes.

1. Take a backup: a dump into a private directory with owner-only permissions (`supabase db dump`
   is itself a production operation that the owner starts), or a backup from the dashboard where
   the plan offers one. There is no down migration; the backup is the way back for data.
2. Connection: in the Supabase dashboard, "Connect" → **Session pooler**. It answers over IPv4 and
   keeps a session, which transactions with schema changes need. The direct connection is IPv6
   only. The user has the form `postgres.<project_ref>`.
3. Plan, without writing:
   `PGHOST=… PGPORT=5432 PGUSER=postgres.<ref> PGPASSWORD=… ALLOW_PRODUCTION_TARGET=<ref> scripts/apply-migrations.sh --dry-run`.
   Expected: 8 applied, `20260924184739` foreign, 11 to apply.
4. Apply: the same command without `--dry-run`. Each migration finishes in seconds. Seed files are
   never applied by this script; they contain sample listings for local development.
5. Check: the script prints the history, 20 versions. The version-1 site, which is still deployed,
   keeps working: start page, a listing, sign-in.
6. Deploy the application ([deployment](PWANOVA_V2_DEPLOYMENT.md)).

### Expected duration and locks

The catalogue is small (27 listings). `alter table apps add column` takes a short exclusive lock on
`apps`; the backfills touch every listing once.

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
