# PWANova V2 — security and privacy

Scope: what V2 added. The controls of version 1 (guarded requests, rate limits, immutable rating
identity, ownership tokens) are still in place and are summarised where V2 builds on them.
Secrets and access to the production accounts are the subject of the owner's secrets and access
plan, which is kept outside of this document.

This is a review by the developer of the code, with automated tests. It is not an external audit.

## 1. Principles

1. The database decides. Pages and actions ask; row level security, triggers and functions answer.
   A rule that matters is never enforced by the page alone.
2. The client is never trusted for `user_id`, role, ownership, verification status, origin of a
   statement, entitlement or price.
3. Private data has its own table. What is not needed is not collected.
4. Every decision by a moderator or an admin leaves a record with the previous and the new value.

## 2. Roles

| Role | How it is given | What it may do |
| --- | --- | --- |
| visitor (`anon`) | — | read public rows |
| member (`authenticated`) | signing in | rate, review, save, follow, compare, submit, request |
| maker | submitting a listing | edit the own listing; statements wait for review |
| verified owner | proving control of the domain | statements are shown as vendor statements; respond to requests; publish updates and launches |
| moderator | `profiles.role`, set by an admin | queue, reports, evidence review, launches, requests |
| admin | `profiles.role`, set in the database | everything a moderator may do, plus settings, plans, entitlements, roles, merges |

There is no "first user is admin". A role is read from the database on every privileged action
(`roleOf`, `require_moderator`, `require_admin`). A change of a role is written to the audit log by
a trigger. A person cannot change the own role (`protect_profile`).

## 3. Row level security

Enabled on all 56 tables of the application. `rate_limits` has no policy: only the service role
reads and writes it. The tables of the other application in the shared project (`business_*`) are
not touched by any migration of this repository.

What the policies guarantee, with the test that shows it (`tests/v2-db.test.ts`,
`tests/v2-owner.test.ts`, `tests/db.test.ts`):

| Guarantee | Test |
| --- | --- |
| A maker's statement is stored as `vendor_stated` or `user_submitted` whatever the client sends | "a verified owner's claim is stored as vendor_stated whatever the client sends" |
| A statement without proven ownership changes no fact | "the same words from somebody who has not proven ownership wait for review and change nothing" |
| What PWANova verified cannot be overwritten by the maker | "what PWANova verified cannot be overwritten by the maker" |
| Evidence cannot be edited or deleted | "evidence is append-only" |
| Trust columns of a listing cannot be set by the maker | "the computed trust columns on the listing are not the maker's to set" |
| Only the service role records a run | "recording a run is reserved for the service role" |
| Unreviewed entries are readable by their author, the managers of the listing and moderators only | "what was typed without proof of ownership is not public, whichever client asks" |
| Contact details of a buyer are readable by the buyer alone | "requirements can be private; contact details are readable by the buyer and nobody else" |
| A vendor sees requirements, never the person | "a matched, verified vendor sees the requirements, never the person" |
| Contact details move only by recorded consent, field by field, and consent can be withdrawn | "contact details move only by the buyer's recorded consent" |
| A paid capability is enforced by the database once monetisation is enforced | "once it is enforced, a response without an entitlement is refused whatever client sends it" |
| Moderator tools need the role and a reason | "moderator tools need the role and a reason" |
| Internal settings and the newsletter list are not public | "public settings are readable, internal ones and the newsletter list are not" |
| Search tolerates hostile input | "caps page size and tolerates hostile input" |

## 4. Functions and views

- Functions that change data are `security definer`, have a fixed `search_path`, and check the
  caller inside (`auth.uid()`, `is_moderator()`, `is_admin()`, ownership).
- Protected columns are guarded by triggers that run with the rights of whoever writes
  (`protect_app`, `protect_evidence`, `protect_launch`, …). They let the service role and moderators
  through. A write that comes from a `security definer` function is seen by these triggers as a
  write of the function's owner and passes; that is why every such function checks its caller
  before it writes, and why `is_service_role()` is never the only check inside one.
- Functions reserved for the service role are revoked from `anon` and `authenticated`.
- Trigger functions are executable by default, as in every Postgres database. They cannot be called
  outside a trigger.
- The three public views (`apps_public`, `catalog_apps`, `launch_board`) run with the rights of
  their owner. They select published listings and public columns only. Supabase's advisor reports
  such views ("security definer view"); here it is the intended way to publish one prepared row per
  listing without opening the tables behind it. A change to one of these views has to be reviewed
  with that in mind.
- Eleven functions of version 1 have no fixed `search_path` (`set_updated_at`, `protect_profile`,
  `protect_review`, `ranking_score`, `trending_score`, `rating_breakdown`, `canonical_app_url`,
  `is_service_role`, `block_self_rating`, `block_self_helpful`, `mark_demo_partner`). None of them
  is `security definer`. They are unchanged by V2; fixing the path is a candidate for a later
  migration.

## 5. Buyer requests: privacy

| Data | Table | Who reads it |
| --- | --- | --- |
| Requirements | `buyer_requests` | the buyer; everybody when the request is public; matched verified vendors |
| Name, e-mail, phone, company | `buyer_request_contacts` | the buyer |
| A consent | `buyer_contact_consents` | the buyer and the vendor it concerns |
| Shared fields | returned by `shared_contact()` | the vendor named in a consent that has not been withdrawn |

- The text of a request is checked for e-mail addresses and phone numbers before it is stored
  (`containsContactDetails`), because vendors read that text.
- A vendor's answer is checked the same way.
- The consent stores the fields, the exact wording the buyer agreed to, who agreed and when.
  Withdrawing sets `revoked_at`; from then on `shared_contact()` returns nothing.
- A notification to the buyer contains no message of the vendor and no personal data.
- The address of a private request cannot be guessed (random public id) and answers 404 for
  everybody but the buyer and matched vendors.
- A plan never unlocks contact data.

## 6. Input

- Every server action validates its input with zod and cleans free text (`cleanText`).
- Addresses of products go through `parsePublicUrl`: `http(s)` only, default ports, no credentials,
  no private or local hosts.
- Keys that come from an address (collection, category, icon name, API parameters) are looked up
  among own keys only (`Object.hasOwn`), so `__proto__` or `constructor` are ordinary text.
- The public API reads the documented parameters only.
- Return addresses after signing in are same-origin paths (`safeNext`).
- Structured data for search engines is serialised with `<` escaped (`jsonLd`).
- Images from other sites are served through `/api/media` as raster images only, with `nosniff`
  and a sandboxing content security policy.
- Filters for the database are built from validated tokens, not from raw text; addresses are
  compared with `eq` and `in`, never inside a filter expression.

## 7. Requests to other sites

See [verification, section 8](PWANOVA_V2_VERIFICATION.md). In short: public hosts only, checked at
connection time; redirects re-validated; limits on time, size and number; no credentials; robots.txt
respected. Tests: `tests/ssrf.test.ts`, `tests/v2-verify.test.ts`.

## 8. Rate limits

Counted in the database (`rate_limits`), so they hold across server instances.

| What | Limit |
| --- | --- |
| Public API `/api/v1/*`, `/api/public/*` | 60 a minute per address |
| Events, badge, media | 120 a minute per address |
| Search suggestions | 60 a minute per address |
| Newsletter | 5 an hour per address |
| Submitting a listing | 5 an hour per person |
| Analysing an address | 20 an hour and 40 a day per person |
| Ownership claim, verification of a claim | 10 and 12 an hour per person |
| Rating, review, helpful vote, save, follow | 40, 15, 120, 120, 120 an hour per person |
| Report | 8 an hour per person |
| Vendor statement, listing edit, pricing, details | 30, 40, 40, 60 an hour per person |
| Update, launch | 10 an hour, 6 a day per person |
| Re-check | 6 an hour per person, 3 a day per listing |
| Buyer request | 5 a day per person |
| Response to a request, sharing and withdrawing contact details | 30 and 20 a day per person |

## 9. What is stored on a visitor's device

Nothing on a visit. `pwn_locale` when a language is picked, `pwn_next` for 15 minutes while
signing in, the session after signing in, local storage for a comparison and for a review draft.
No advertising, no cross-site tracking, no third-party script. The list is published on the
privacy page. Test: "a visit stores nothing; picking a language is remembered".

## 10. Statistics

Events carry no IP address. For de-duplication the server keeps a hash of the address with a salt
that changes daily. Raw events are deleted after 180 days. Events from another origin are refused
(403). An unknown partner code is not a partner.

## 11. Response headers

`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy` without camera, microphone and location, `Strict-Transport-Security` for two
years, `X-Frame-Options: SAMEORIGIN` everywhere except the embeddable card, which may be framed.
There is no general content security policy yet; see section 14.

## 12. Audit trail

`audit_logs`: actor, action, target, previous and new values, reason, time. Written by the
moderator and admin functions and by triggers on `site_settings`, `sponsor_campaigns` and
`profiles.role`. Operator details are not copied into the log. Readable by admins only.
`admin_actions` of version 1 continues for listing moderation.

## 13. Secrets

- No new environment variable was added by V2.
- The service role key is used on the server only; nothing secret has a `NEXT_PUBLIC_` name.
- `.env*` files are ignored by git. `.env.local` points at the local stack.
- Scripts that write refuse a cloud target unless `ALLOW_PRODUCTION_TARGET` names the project for
  that one run.
- The cron route requires `CRON_SECRET` as a bearer token and answers 401 without it.
- The application logs the error message of a failed database call. It does not log tokens, keys,
  request bodies or contact data.

## 14. Known limits and open points

| Point | Status |
| --- | --- |
| Content security policy for pages | not set. Needs a nonce for the theme script and the structured data; planned, not part of V2 |
| Supabase advisor | not run against production for V2, because V2 is not applied there. Expected findings: the three views (section 4) and the version-1 functions without a fixed `search_path` |
| Version-1 functions without fixed `search_path` | unchanged, none is `security definer` |
| Shared Supabase project | V2 names every object it touches. Separating the two applications is the owner's decision |
| Leaked-password protection, MFA, e-mail templates | settings of the Supabase project, not of this repository |
| Abuse of vendor statements | a verified owner can state something untrue. The statement is labelled as the vendor's, carries a source address, can be reported, and never counts as verified |
| Admin area | English only; usable on a phone, designed for a desktop |
| External audit | none |
