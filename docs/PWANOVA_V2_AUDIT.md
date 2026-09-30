# PWANova V2 — audit of the existing product

Date: 2026-09-29. Audited state: `main` at `cac752c` (version 1, the closed beta).
Purpose: record what existed before the V2 work started, what was kept, and what had to change.

This document describes version 1. What V2 added is in
[architecture](PWANOVA_V2_ARCHITECTURE.md), [data model](PWANOVA_V2_DATA_MODEL.md) and
[migration](PWANOVA_V2_MIGRATION.md).

## 1. Summary

Version 1 was a working directory of web apps with ratings, reviews, ownership verification and a
partner kit. It was honest about what it knew, and its security basics were in place. It was not yet
a trust platform: what it knew about an app was a handful of technical flags, in one language, without
history and without a way to compare or to ask for a recommendation.

V2 keeps the repository, the Supabase project, the Vercel project, the framework, every table, every
id, every slug and every review. Nothing was recreated.

## 2. Stack (unchanged by V2)

| Layer | Version 1 | V2 |
| --- | --- | --- |
| Framework | Next.js 16.3.5, App Router, Turbopack, `proxy.ts` | same |
| UI | React 19.2.8, TypeScript 5, Tailwind 4, shadcn/ui on Base UI, Lucide, sonner | same |
| Backend | Supabase: Auth (magic link, optional GitHub/Google), Postgres 17, Storage | same project |
| Hosting | Vercel, region `fra1`, one daily cron | same project |
| Tests | Node test runner + PGlite (in-process Postgres), Playwright | same tools, more tests |
| Dependencies | 17 runtime, 11 development | **no dependency added or removed** |

## 3. What version 1 contained

### Pages (22) and route handlers (7)

`/`, `/explore`, `/top`, `/trending`, `/new`, `/categories`, `/categories/[slug]`, `/apps/[slug]`,
`/apps/[slug]/claim`, `/developers/[username]`, `/ship`, `/dashboard`, `/saved`, `/activity`,
`/profile`, `/sign-in`, `/admin`, `/pricing`, `/for-developers`, `/partners`, `/partners/demo`,
`/review-rules`, plus `/offline` and `/embed/app/[slug]`.

`/api/badge/[slug]`, `/api/cron/health`, `/api/events`, `/api/media`,
`/api/public/apps/by-domain`, `/auth/callback`, `/auth/sign-out`.

`robots.txt`, `sitemap.xml`, the web app manifest, icons and the Open Graph image existed.

### Database (18 tables, 8 migrations)

`profiles`, `apps`, `app_screenshots`, `app_sources`, `app_checks`, `app_claims`, `app_events`,
`ratings`, `reviews`, `review_helpful`, `developer_responses`, `favorites`, `reports`,
`admin_actions`, `partners`, `partner_members`, `partner_referrals`, `rate_limits`, and the public
view `apps_public`.

Row level security was enabled on every table. Identity columns of ratings and reviews were
immutable, owners could not rate their own apps, and moderation left a record in `admin_actions`.

### Features that worked and were kept as they are

- Ratings and reviews: one rating per person and app, review text and stars removable
  independently, helpful votes, owner responses, guest drafts that survive signing in.
- Ownership verification through `/.well-known/pwanova-verification.txt` with expiring tokens.
- Partner kit: badge image, embeddable card, public lookup API, referral attribution.
- Moderation queue, reports, audit entries.
- Guarded server-side requests (`src/lib/security/ssrf.ts`): public hosts only, DNS checked at
  connection time, redirects re-validated, size and time limits.
- Shared rate limits in the database, response security headers, demo data kept apart by `is_demo`.
- Health check cron and deletion of raw events after 180 days.

## 4. Gaps against the V2 brief

| Area | Version 1 | Consequence for V2 |
| --- | --- | --- |
| Languages | English only, no language in the address | every page moved under `/en` and `/de`, with redirects |
| Knowledge about an app | one row per app in `app_checks` with ten boolean columns; reachability, HTTPS and the manifest were observed, the rest stayed unknown | fact registry, evidence history, separate verified and vendor layers |
| Origin of a statement | not recorded | `pwanova_observed`, `admin_reviewed`, `vendor_stated`, `user_submitted` on every row |
| Unknown | shown as "Unknown" for checks, but filters were boolean | three states in the database, in filters, in the API |
| History | checks were overwritten | append-only evidence, superseded rows stay |
| Staleness | none | time to live per fact, `next_check_at`, state "evidence outdated" |
| Search | substring match (`ilike`) on one text column | full-text search with trigram similarity, in the database |
| Ranking | one `ranking_score` from ratings | documented organic score, published on `/how-ranking-works` |
| Categories | text column on `apps`, 16 slugs defined in code | taxonomy of 24 categories in the database with names in both languages; renamed slugs redirect |
| Company, pricing, data locations, subprocessors, AI providers | absent | structured tables, each row with its origin |
| Compare, alternatives, collections | absent | added |
| Launches | `app_sources` recorded where an app launched | launches with a 30-day window, moderated |
| Buyer requests | absent | added, with contact data in a separate table and consent per vendor |
| Follows, notifications, updates | `/activity` listed own actions | follows, maker updates, in-app notifications |
| Plans | static pricing page | plans and entitlements in the database, no payment provider |
| Sponsored content | absent | separate table and surfaces, labelled, off by default |
| Legal pages | review rules only | imprint, privacy, terms, methodology, ranking, sponsorship |
| Public API | one lookup endpoint | versioned `/api/v1/…`, the old endpoint keeps working |
| Types | hand-written row types, untyped Supabase clients | generated `Database` types, typed clients |

## 5. Risks found during the audit

1. **The Supabase project is shared.** Project `nnkdvisfstrcvrpkbsye` also holds the tables of another
   application (`public.business_*`), its migration versions and its users. V2 migrations name
   every object they touch and never iterate over "all tables" or "all functions" of the schema.
   Because both applications write to one migration history, the Supabase CLI refuses to push for
   either of them; see [migration, section 4](PWANOVA_V2_MIGRATION.md).
2. **Production data must survive.** All V2 migrations are additive. No column, row, id or slug is
   dropped or rewritten. `apps.category` (text) stays next to the new taxonomy.
3. **Old addresses are linked from outside** (badges, embeds, partner boards, search engines). Every
   address of version 1 either still answers or redirects; see [redirects](PWANOVA_V2_REDIRECTS.md).
4. **Sign-in links.** The redirect address of a magic link carried a `?next=` parameter, which does
   not match an exact entry of the allow-list and made Supabase fall back to the site URL. V2 sends
   the exact `/auth/callback` and keeps the destination in a short-lived cookie.
5. **A visit through a partner link stored a cookie** (`pwn_ref`, 30 days) without asking. V2 stores
   nothing on a visit, whichever link it came through; attribution travels in the address.
6. **Demo data.** Seeded listings are fabricated. They remain excluded from every public surface
   unless a deployment explicitly runs in demo mode, and they are never indexed.
7. **Operator data is missing.** Imprint and privacy pages need the operator's name, address and
   contact. The pages exist as templates, mark what is missing, and stay out of search engines until
   the owner enters the data in Admin → Settings.

## 6. Decisions

- Extend, do not replace. New behaviour is built next to the old tables; the old columns stay valid.
- One repository, one deployment, no new service. Search, matching and verification run in Postgres
  and in the existing server functions.
- Evidence, not certification. No page and no API field states that a product is compliant, safe or
  certified. PWANova records what it found, where, and when.
- Everything paid is switched off by a setting (`monetization.enforced = false`) and enforced by the
  database once it is switched on.

## 7. What was removed

| Removed | Replaced by |
| --- | --- |
| `/explore`, `/top`, `/trending`, `/new` pages | `/discover` with sorting; the old addresses redirect |
| `/ship` | `/submit` |
| `/for-developers` | `/for-makers` |
| `/activity` | `/notifications` |
| `components/app/app-card.tsx`, `explore-filters.tsx`, `quality-panel.tsx`, `ship-form.tsx`, `admin-actions.tsx`, `lib/search-params.ts` | components under `components/catalog`, `components/trust`, `components/submit`, `components/admin`, `lib/v2/params.ts` |
| `tests/e2e/beta.spec.ts` | `tests/e2e/v2.spec.ts`, which covers the same journeys in the new structure |
| cookie `pwn_ref` | `?ref=` in the address, passed along with the event |

No database object was removed.
