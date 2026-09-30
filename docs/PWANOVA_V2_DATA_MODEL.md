# PWANova V2 — data model

PostgreSQL 17 on Supabase, schema `public`. Version 1 had 18 tables; V2 adds 38 tables and two views
and adds columns to four existing tables. Nothing was dropped or renamed. The schema is built by the
eleven migrations `20260929100000` to `20260929101000`.

Row level security is enabled on every table. The column "Write" below names who may write through
the API; the service role and database functions are described separately.

## 1. Words used in every table

### Origin (`source_type`)

| Value | Meaning | Written by |
| --- | --- | --- |
| `pwanova_observed` | PWANova fetched the source itself and checked it | service role (verification engine) |
| `admin_reviewed` | a moderator read the source | moderators, through `review_evidence` / `admin_set_fact` |
| `vendor_stated` | the verified owner of the listing says so | verified owners |
| `user_submitted` | somebody else says so, including an owner who has not proven ownership yet | anybody signed in |

A client cannot choose the origin. A trigger (`stamp_fact_source`, `protect_evidence`) sets it from
who is writing: a verified owner's row becomes `vendor_stated`, anybody else's `user_submitted`.

### State (`value_state`, `verified_state`, `vendor_state`, `effective_state`)

`yes`, `no`, `unknown`. Unknown is a state of its own. A missing row means unknown.

### Outcome of a check (`verification_results.outcome`)

`found`, `not_found`, `could_not_check`, `skipped`. Only `found` with a state changes an answer.
`not_found` for a document means "no link found", which is no answer. `could_not_check` leaves
everything as it was.

## 2. Taxonomy and companies (migration `…100000_v2_foundation`)

| Table | Purpose | Read | Write |
| --- | --- | --- | --- |
| `categories` | 24 categories, names and descriptions in both languages, `legacy_keys` map the version-1 slugs | everybody | admins |
| `app_categories` | categories of an app, one primary | everybody | owner, moderators |
| `use_cases`, `app_use_cases` | what a product is used for (24 seeded) | everybody | admins / owner |
| `companies` | the company behind a product: name, legal name, country, website, with origin | everybody once it is accountable (see below); before that its author and moderators | creator, moderators |
| `app_translations` | tagline and description in another language | everybody for published apps | owner |
| `app_platforms`, `app_languages` | where it runs, which languages it offers, with origin | everybody, except rows of origin `user_submitted` | owner |
| `integration_catalog`, `app_integrations` | integrations (24 seeded), with origin | everybody, except rows of origin `user_submitted` | admins / owner |
| `pricing_plans` | the vendor's plans with price, interval and source | everybody, except rows of origin `user_submitted` | owner |
| `app_data_locations`, `app_subprocessors`, `app_ai_providers` | where data is processed, by whom, with which AI provider, each row with origin and source | everybody, except rows of origin `user_submitted` | owner |

A company is public only when somebody accountable stands behind it: PWANova observed or reviewed
it, or the verified owner of a public listing stated it (`company_is_public`). What somebody typed
without having proven ownership (`user_submitted`) is readable by its author, by the people who
manage the listing and by moderators, and by nobody else. The database enforces this (migration
`…101000_v2_unreviewed_rows`), so it holds for every client, not only for the pages.

`is_eu_country(code)` knows the 27 member states; `is_eea_country(code)` adds Iceland,
Liechtenstein and Norway. Switzerland is "outside the EU", not unknown.

### Columns added to `apps`

`company_id`, `primary_category_id`, `aliases`, `content_locale`, `pricing_model`,
`has_free_plan`, `has_free_trial`, `starting_price_cents`, `price_currency`, `founded_year`,
`verification_state`, `evidence_score`, `evidence_checked_at`, `next_check_at`,
`profile_completeness`, `duplicate_of`, `search_vector`, `search_text`.

`has_free_plan` and `has_free_trial` are nullable: null means "not stated". The computed columns
(`verification_state`, `evidence_score`, `evidence_checked_at`, `profile_completeness`,
`search_*`) cannot be set by a maker (`protect_app`).

Other existing tables: `profiles.locale` and the role `moderator`; `reviews.status` (kept in step
with `hidden_at`); `reports.evidence_id`, `launch_id`, `request_id` and more reasons;
`app_events` accepts `compare_added`, `follow`, `launch_view`.

## 3. Evidence (migration `…100100_v2_evidence`)

| Table | Purpose | Read | Write |
| --- | --- | --- | --- |
| `fact_attributes` | the registry: key, dimension, value type, labels for yes and no, time to live, flags | everybody | admins |
| `app_evidence` | append-only history of statements and observations | current and superseded rows of public apps; pending, rejected and retracted rows only for their author, the managers of the listing and moderators | insert by owners and submitters; the author of a vendor statement may retract it; what was said cannot be edited, and nothing is deleted |
| `verification_runs` | one row per run: type, status, time, who started it | everybody for public apps | service role |
| `verification_results` | one row per check of a run | everybody for public apps | service role |
| `app_facts` | the current answer per app and fact | everybody for public apps | functions only |

`app_facts` keeps two layers side by side:

```
verified_state, verified_value, verified_source_type, verified_source_url, verified_at
vendor_state,   vendor_value,   vendor_source_url,    vendor_stated_at
effective_state, effective_source   -- verified wins; otherwise the vendor statement; otherwise unknown
last_attempt_at, last_attempt_outcome
```

### The fact registry

| Dimension | Keys |
| --- | --- |
| company | `company_identified`, `company_country`, `eu_company`, `legal_notice`, `contact_available` |
| data | `privacy_policy`, `terms_of_service`, `dpa_available`, `subprocessors_published`, `eu_hosting_available`, `retention_documented`, `no_training_on_customer_data` |
| ai | `ai_used`, `ai_provider_disclosed`, `ai_transparency_info` |
| technical | `website_reachable`, `https`, `pwa_manifest`, `offline_capable`, `api_available`, `mcp_available`, `open_source`, `self_hosted`, `sso`, `security_txt` |
| product | `pricing_page`, `free_plan`, `german_available`, `source_repository`, `api_docs`, `changelog` |

Twelve facts are "expected": they make up evidence completeness. Each fact has a time to live
between 7 and 365 days. Which facts the engine checks by itself is listed in
[verification](PWANOVA_V2_VERIFICATION.md).

### Functions

| Function | Caller | What it does |
| --- | --- | --- |
| `record_verification_run(app, url, type, by, results)` | service role | stores a run and its results, appends evidence, refreshes facts, sets `next_check_at` |
| `observe_fact(...)` | internal | appends or confirms one observation |
| `refresh_app_facts(app)`, `refresh_app_trust(app)` | internal | recompute `app_facts` and the trust columns of the listing |
| `compute_evidence_score(app)`, `compute_profile_completeness(app)` | internal | the two percentages |
| `my_app_profile_report(app)` | owner | what is missing in the profile |
| `review_evidence(id, decision, reason)` | moderator | accepts or rejects a submitted statement |
| `admin_set_fact(...)` | moderator | records a manual review with source and reason |
| `request_recheck(app)` | owner, moderator | asks for a new run; three a day per listing |
| `promote_owner_statements()` (trigger) | — | when ownership is verified, the owner's earlier entries become vendor statements as new rows |

## 4. Engagement (migration `…100200_v2_engagement`)

| Table | Purpose | Read | Write |
| --- | --- | --- | --- |
| `follows`, `category_follows` | who follows which app or category | the person | the person |
| `app_updates` | updates published by the maker | everybody when published | owner |
| `notifications` | in-app notifications | the person | functions; the person may mark as read or delete |
| `comparisons`, `comparison_apps` | saved comparisons, at most four apps | the person | the person |
| `app_alternatives` | "alternative to", with origin | everybody | owner, moderators |

Ratings, reviews, helpful votes, responses and saves are the tables of version 1, unchanged.

## 5. Launches (migration `…100300_v2_launches`)

`launches`: headline and description in both languages, status (`draft`, `pending`, `approved`,
`rejected`, `cancelled`), a window of 30 days that starts with approval. One launch per app at a
time. The view `launch_board` orders approved launches by distinct signed-in people who saved,
followed, reviewed (at least 80 characters) or opened the app during the window, plus evidence,
profile completeness and recency. The maker's own actions do not count. There is no vote counter.

## 6. Buyer requests (migration `…100400_v2_buyer_requests`)

| Table | Holds | Read |
| --- | --- | --- |
| `buyer_requests` | requirements: categories, use cases, languages, required facts, integrations, platforms, budget, visibility | the buyer; everybody when public; matched verified vendors |
| `buyer_request_contacts` | name, e-mail, phone, company of the buyer | the buyer alone |
| `buyer_request_matches` | the short list with reasons | the buyer; a vendor sees its own entry |
| `buyer_request_responses` | a vendor's answer | the buyer and that vendor |
| `buyer_contact_consents` | which fields the buyer shared with which vendor, the wording agreed to, when, and when withdrawn | the buyer, and the vendor it concerns (the consent, not the contact data) |

A vendor reads shared contact details only through `shared_contact(request, app)`, which returns
the fields of a consent that has not been withdrawn. `share_contact` and `revoke_contact` are the
only ways to change a consent. Direct reads of the contact table return nothing for anybody but the
buyer. A paid plan never unlocks contact data.

## 7. Platform (migration `…100500_v2_platform`)

| Table | Purpose | Read | Write |
| --- | --- | --- | --- |
| `site_settings` | feature switches and settings; `is_public` marks what visitors may read | public rows: everybody | admins |
| `plans` | plans with prices in cents, interval, entitlements | public rows: everybody | admins |
| `entitlements` | which listing or company has which plan, from when to when, granted by whom | the holder, admins | `grant_entitlement`, `revoke_entitlement` |
| `sponsor_campaigns` | sponsored placements: placement, period, status | active ones: everybody | admins |
| `newsletter_subscriptions` | e-mail, language, wording and time of the consent | a signed-in subscriber reads the own row, admins read all | the server |
| `audit_logs` | who changed what, previous and new values, reason | admins | functions and triggers |

### Plans at the time of writing

| Plan | For | Price | Entitlements | Orderable |
| --- | --- | --- | --- | --- |
| `basic` | makers | free | — | yes |
| `verified` | makers | 49 EUR once | `verification.priority` | no |
| `launch-pro` | makers | 99 EUR once | `verification.priority`, `launch.extended`, `launch.analytics` | no |
| `maker-pro` | makers | 29 EUR a month | `analytics.advanced`, `updates.notify`, `profile.enhanced` | no |
| `vendor-pro` | vendors | 149 EUR a month | `buyer_requests.respond` | no |
| `category-sponsor` | sponsors | 199 EUR a month | `sponsor.category` | no |
| `newsletter-sponsor` | sponsors | 299 EUR an issue | `sponsor.newsletter` | no |

Prices are marked as approximate and are shown as announced, not as an offer. No plan contains
ranking, a better position in search, or a trust label.

### Moderator and admin functions

`moderate`, `decide_launch`, `moderate_request`, `review_evidence`, `admin_set_fact`,
`merge_duplicate_app`, `revoke_ownership`, `reassign_app_owner` (version 1), `grant_entitlement`,
`revoke_entitlement`. Each checks the caller's role in the database (`require_moderator`,
`require_admin`), requires a reason where a decision is made, and writes an audit entry.

Changes to `site_settings`, `sponsor_campaigns` and `profiles.role` are recorded by triggers
(migration `…100900_v2_admin_audit`). Operator details are not copied into the log.

## 8. Search and catalogue (migration `…100600_v2_search_catalog`)

- View `catalog_apps`: one row per public listing with everything a card, a filter or the API
  needs: category, company, pricing, trust columns, facts as JSON, arrays of languages, platforms,
  integrations, use cases, the weighted rating and the organic score.
- `search_catalog(...)` returns ranked ids; `popular_apps()` returns a list only above the
  thresholds in `site_settings.popular`; `duplicate_target(slug)` names the listing a merged
  duplicate points at.
- Triggers keep `apps.search_vector` and `apps.search_text` current.

## 9. Views and functions: how they run

The three public views (`apps_public`, `catalog_apps`, `launch_board`) run with the rights of their
owner and select public rows and public columns only. This is deliberate: visitors read one
prepared row per listing and get no access to the tables behind it.

Functions that change data are `security definer` with a fixed `search_path` and check the caller
inside. Helper functions used by policies (`is_admin`, `is_moderator`, `manages_app`, `owns_request`,
…) answer about the caller only.

## 10. Generated types

`npm run db:types` writes `src/lib/database.types.ts` from the local database. The Supabase clients
are typed with it, so a renamed column is a compile error.
