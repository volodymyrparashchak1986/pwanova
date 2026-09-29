# PWANova V2 — architecture

PWANova V2 is one Next.js application on Vercel and one Postgres database on Supabase. There is no
other service: search, matching, ranking and verification run in the database and in the
application's own server functions.

Product model: **discover → verify → compare → launch → buy.**

## 1. Overview

```
Browser ──► proxy.ts ──► pages (React Server Components) ──► src/lib/data/*  ──► Postgres (RLS)
                │             │                                                   ▲
                │             └─► server actions (src/actions/*) ─────────────────┤
                │                                                                 │
                └─► /api/v1/* (public, read-only) ────────────────────────────────┤
                                                                                  │
Vercel Cron ──► /api/cron/health ──► verification engine ──► record_verification_run()
                                        │
                                        └─► product websites (guarded requests only)
```

- **Reads** go through `src/lib/data/*` with the visitor's own session, so row level security decides
  what comes back.
- **Writes** go through server actions. An action resolves the signed-in person on the server, applies
  a rate limit, validates the input with zod and calls the database with that person's session. The
  database decides whether the write is allowed; the action never takes an id, a role or a status
  from the client as a fact.
- **The service role** never reaches the browser and is used on the server for a fixed list of
  tasks, each after the caller was checked: recording health checks and verification runs (cron and
  engine), recording events, shared rate limits, storing a newsletter subscription, looking up
  duplicates at submission (a listing that waits for review counts too), finalising an ownership
  claim, writing the short list of a request, and telling a buyer in the app that a vendor answered.

## 2. Directory map

| Path | What it holds |
| --- | --- |
| `src/proxy.ts` | language redirect, redirects of version-1 addresses, session refresh |
| `src/app/[locale]/(site)/` | every page, under `/en` and `/de` |
| `src/app/(plain)/` | `/offline` and `/embed/app/[slug]`: no language prefix, own root layout |
| `src/app/api/v1/` | public API, version 1 |
| `src/app/api/` | events, badge, media proxy, cron, the version-1 lookup endpoint |
| `src/app/auth/` | sign-in callback and sign-out |
| `src/actions/` | server actions: `account`, `apps`, `engagement`, `maker`, `requests`, `admin`, `catalog` |
| `src/lib/data/` | reads: `catalog`, `account`, `maker`, `requests`, `admin`, `lookups`, `index` (version 1) |
| `src/lib/v2/` | rules without a database: addresses, comparison keys, trust display, matching, collections |
| `src/lib/v2/verify/` | the verification engine and its link rules |
| `src/lib/security/` | guarded requests, rate limits, sanitising, body parsing |
| `src/i18n/` | languages, dictionaries, formatting |
| `src/content/` | long texts in both languages: methodology, ranking, sponsorship, review rules, legal |
| `src/components/` | `catalog`, `trust`, `compare`, `launches`, `requests`, `dashboard`, `submit`, `admin`, `app`, `layout`, `ui` |
| `supabase/migrations/` | the schema; see [migration](PWANOVA_V2_MIGRATION.md) |
| `tests/` | unit and database tests (Node test runner, PGlite), `tests/e2e` (Playwright) |

## 3. Languages

- Every page lives under a language: `/en/...` and `/de/...`. APIs, auth routes, embeds, the offline
  page and static files have one address without a language (`isUnprefixedPath` in `src/i18n/config.ts`).
- An address without a language is redirected (307) to the language the visitor chose earlier
  (`pwn_locale`), otherwise to the best match of `Accept-Language`, otherwise to English.
- The root layout is `src/app/[locale]/layout.tsx`. Server code reads the language from the root
  parameter (`next/root-params`), so components do not pass it down.
- Dictionaries are TypeScript objects. English is the source of truth; the type of the German
  dictionary is derived from it, so a missing key is a compile error.
- The browser receives the namespaces every page needs (`CLIENT_NAMESPACES`). Larger namespaces
  (dashboard, submit, requests, …) are sent only by the pages that use them, through `<I18nScope>`.
- Names of categories, use cases, facts and plans are stored as `{ "en": …, "de": … }` in the database.
- Every indexable page names its other language (`hreflang`, `x-default`) and its canonical address.
- Adding a language: add it to `LOCALES`, add a dictionary, add the labels in the database. No schema
  change.

The admin area is English only.

## 4. The trust pipeline

```
fact_attributes         what can be known about an app (31 keys in five dimensions)
      │
app_evidence            every statement and observation, append-only, with source and date
      │   ▲
      │   └── verification engine · moderators · verified owners · submitters
      ▼
app_facts               the current answer per app and fact:
                        verified_* columns  +  vendor_* columns  →  effective_state, effective_source
      ▼
apps.verification_state, evidence_score, evidence_checked_at, next_check_at
      ▼
catalog_apps (view)     what pages, search and the API read
```

Rules that hold everywhere:

1. **Three states.** `yes`, `no`, `unknown`. Unknown is never shown, filtered or exported as no.
2. **Origin is part of the answer.** "Checked by PWANova", "Reviewed by PWANova", "Stated by the
   vendor". A statement of somebody who has not proven ownership waits for review and is not shown.
3. **A vendor statement never overwrites a verified result.** Both are stored; when they exist, both
   are shown.
4. **History is kept.** A new result is a new row; the old row is marked as replaced.
5. **"Could not check" changes nothing.** A check that could not run leaves the earlier answer and
   its date as they were.
6. **No verdicts.** Answers are spelled out ("Privacy policy found", "No training on customer data").
   No page says compliant, certified, safe or guaranteed.

Details: [verification](PWANOVA_V2_VERIFICATION.md).

## 5. Search and ranking

- `search_catalog(p_query, p_filters, p_sort, p_limit, p_offset)` returns ranked ids and the total.
  It combines full-text search (`simple`, `english` and `german` configurations, accents removed)
  with trigram similarity, so a typo still finds the product.
- The search document of an app is kept up to date by triggers: name and aliases (weight A),
  tagline and use cases (B), description, categories and integrations (C), domain, company, host
  and confirmed capabilities (D).
- Filters combine with AND. Values inside one filter combine with OR, except trust facts: every
  selected fact has to be yes. "Verified evidence only" ignores vendor statements.
- The organic score: evidence completeness 30 %, engagement 25 % (logarithmic), profile
  completeness 20 %, weighted rating 15 %, freshness of the evidence 10 %. The rating is pulled
  towards a neutral value while there are few ratings; without ratings its share is zero.
- Nothing paid is part of the score. Sponsored placements are rows of another table, shown in
  separate, labelled surfaces ("Sponsored" / "Anzeige"), and switched off by default.
- The formula is published on `/how-ranking-works`.

## 6. Addresses as state

- Catalogue: `parseCatalogParams` reads a query string, `catalogQuery` writes it in one fixed order.
  Equal filters give equal addresses, so a filtered view can be shared and cached.
- Comparison: up to four apps, slugs in alphabetical order, joined by `-vs-`
  (`/compare/a-vs-b`). Any other order redirects to the canonical one.
- Collections are saved filters with a name (`/collections/<slug>`). A collection with fewer than
  three listings is not indexed.
- Filtered, searched or paginated catalogue pages carry `noindex, follow`.

## 7. Buyer requests

A request has two parts, in two tables: the requirements, and the person. Matching
(`src/lib/v2/matching.ts`) is deterministic: a documented requirement counts 3 when PWANova
verified it, 2 when the vendor states it, 0 when nobody knows. The short list has at most five
entries and says for each requirement how it is documented.

A matched, verified vendor sees the requirements and can answer. The vendor sees contact details
only after the buyer has agreed, per vendor and field by field; the agreement is stored with its
wording and can be withdrawn.

## 8. What is stored on the visitor's device

| What | When | How long |
| --- | --- | --- |
| Session cookies (`sb-…`) | after signing in | until signing out |
| `pwn_next` | while signing in | 15 minutes |
| `pwn_locale` | when a language is picked | one year |
| Local storage `pwn:compare` | when an app is added to a comparison | until cleared |
| Local storage review draft | while writing a review | 24 hours |
| Service worker cache | first visit, in browsers that support it | until replaced |

A visit without any of these actions stores no cookie and no local storage entry (covered by an
end-to-end test). There is no advertising or cross-site tracking, so there is no consent banner.

## 9. Statistics

Events (`/api/events`) carry the app, the kind of action, the source, the language edition and, for
a signed-in person, the account. They carry no IP address. To avoid counting an action twice the
server keeps a hash of the IP address that is salted with a value that changes daily. Raw events
are deleted after 180 days. Partner attribution comes from `?ref=` in the address.

## 10. Public API

`/api/v1/apps`, `/api/v1/apps/{slug}`, `/api/v1/apps/{slug}/evidence`, `/api/v1/apps/by-domain`,
`/api/v1/categories`, `/api/v1/facts`. Read-only, public data only, CORS enabled, 60 requests a
minute per address, responses cacheable for five minutes. `lang` selects the language of the
answer; `language` filters by the languages an app is available in. A fact that is missing from a
response is unknown. The version-1 endpoint `/api/public/apps/by-domain` keeps its response.

## 11. Plans and feature switches

`site_settings` holds the switches: `features` (compare, launches, requests, newsletter,
sponsorship), `monetization.enforced`, `verification` (daily budget, re-check interval),
`popular` (thresholds below which no "popular" list is shown), `operator` (legal details).

Plans and their prices are rows of `plans`. No payment provider is connected: an admin grants an
entitlement. While `monetization.enforced` is false, nothing is paywalled. When it is true, the
database enforces the paid capability (for example a trigger on `buyer_request_responses`).

## 12. Rendering and caching

Pages are rendered on the server on demand; there is no page cache that could show one person's
view to another. Public API responses and generated icons carry cache headers. The service worker
caches static files and the offline page only.

## 13. Layout rules

- Designed for phones first; every page is tested at 320 px and 375 px for sideways scrolling.
- A grid without named columns has one column as wide as the grid. A scrolling frame contains what
  is positioned inside it. Form controls and buttons are never wider than their container, and a
  button label wraps when it has to (`src/app/globals.css`, `src/components/ui/button.tsx`).
- Tables in long texts become labelled lists on narrow screens (`ProseTable`).
- Headings may break inside long German compounds.
