# PWANova V2 — verification

PWANova records evidence. It does not certify anything. This document says what is checked, how,
what a result means, and what PWANova deliberately does not conclude. The public version of this
text is the page `/verification-methodology`.

Code: `src/lib/v2/verify/engine.ts`, `src/lib/v2/verify/links.ts`, `src/lib/security/ssrf.ts`.
Database: `supabase/migrations/20260929100100_v2_evidence.sql`.
Tests: `tests/v2-verify.test.ts`, `tests/v2-db.test.ts`, `tests/ssrf.test.ts`.

## 1. Where an answer can come from

| Label on the site | `source_type` | How it comes about |
| --- | --- | --- |
| Checked by PWANova | `pwanova_observed` | a verification run fetched the source and checked it |
| Reviewed by PWANova | `admin_reviewed` | a moderator read the source; source and reason are stored |
| Stated by the vendor | `vendor_stated` | the verified owner of the listing states it, with a source address |
| (not shown) | `user_submitted` | somebody without proven ownership states it; it waits for a moderator |

The two layers "verified" and "vendor" are stored separately. A vendor statement never overwrites a
verified result. When ownership is verified, what the owner entered before becomes a vendor statement
as a new row; the waiting row is marked as replaced.

## 2. The three states

`yes`, `no`, `unknown`. A listing nobody has checked has no answers. No filter, no comparison, no
API response and no matching treats that as a no. In the interface unknown reads "Not verified".

## 3. What a run checks

A run looks at the public website of one product. It reads text and never executes code of the site.

| Fact | How | A "no" is recorded when |
| --- | --- | --- |
| `website_reachable` | the start page answers with a status below 400 | the site answers with a client error |
| `https` | the final address is `https:` and no redirect went down to `http:` | it is served over `http:` |
| `pwa_manifest` | the start page links a manifest that has a name and a start address | there is no link, or the manifest is not valid |
| `security_txt` | `/.well-known/security.txt` exists and has a `Contact:` line | the standard address has no such file |
| `german_available` | the start page declares German (`lang`, `hreflang`) | never: a missing declaration is no answer |
| `privacy_policy`, `legal_notice`, `terms_of_service`, `dpa_available`, `subprocessors_published`, `pricing_page`, `api_docs`, `changelog`, `contact_available`, `source_repository`, `mcp_available`, `ai_transparency_info` | a link on the start page names the document; the linked page is fetched and has to read like that document | never: "no link on the start page" is no answer |
| `api_available` | follows from public API documentation that was found | never |

Everything else in the registry (for example `eu_hosting_available`, `no_training_on_customer_data`,
`open_source`, `sso`) is not concluded automatically. It can be stated by the vendor or reviewed by a
moderator.

### Finding documents

- A link counts by the **last part of its address** or by a **short link text** (at most 60
  characters). `/blog/our-privacy-story` is a blog post, not a privacy policy.
- Wording is recognised in English and in German (for example "Imprint" and "Impressum", "DPA" and
  "AVV").
- The rule for data processing agreements runs before the rule for privacy policies, so one is not
  taken for the other.
- A pricing page has to be on the product's own site. A repository has to be a repository on a
  known host, not a page of that host.
- A document counts as found only after its own page was fetched and a confirming passage was
  found. The passage is stored as a short quote.
- A PDF cannot be read here. It counts only when its link text and its address leave no doubt.

## 4. Outcomes

| Outcome | Meaning | Effect on the answer |
| --- | --- | --- |
| `found` | the check ran and found something | the answer is set, the source and the quote are stored |
| `not_found` with a state | the check ran and the thing is definitely not there | the answer becomes no |
| `not_found` without a state | nothing was found where PWANova looked | none: the fact stays as it was |
| `could_not_check` | the site did not answer, answered with a server error, refused, or time ran out | none: the earlier answer and its date stay |
| `skipped` | robots.txt closes the page, or the request budget was used up | none |

If the start page cannot be reached at all, every check of the run is `could_not_check` and nothing
is concluded.

## 5. History

- `app_evidence` is append-only. Seeing the same thing again confirms the existing row
  (`last_confirmed_at`, number of confirmations). Seeing something different appends a row and marks
  the old one as superseded.
- The evidence page of a listing (`/apps/{slug}/evidence`) shows current and replaced entries with
  source, date and quote.
- Every run is stored with its results (`verification_runs`, `verification_results`), including
  the checks that could not run.

## 6. Age of evidence

- Every fact has a time to live (7 to 365 days), depending on how often that kind of fact changes.
  A verified answer within it is current, up to twice that age it is shown as ageing, beyond that as
  outdated. It always carries its date; it is not deleted and not turned into a no.
- A listing whose last verification is older than 180 days has the state "evidence outdated".
- After a run `next_check_at` is set to 30 days later. The daily job takes the listings that are
  due, oldest first.
- The share of freshness in the organic score falls to zero over 180 days.

### States of a listing

| State | Meaning |
| --- | --- |
| `unverified` | PWANova has not verified any of the expected evidence |
| `pending` | a run is queued or running |
| `partially_verified` | some of the expected evidence is verified |
| `evidence_verified` | at least half of the expected evidence is verified, including HTTPS, a privacy policy and a legal notice |
| `stale` | the last verification is older than 180 days |
| `verification_failed` | the last run could not complete and nothing is verified |

"Evidence verified" describes the evidence. It is not a statement about the product's quality,
security or legal compliance.

## 7. When runs happen

| Trigger | Run type | Limit |
| --- | --- | --- |
| Daily job `/api/cron/health` (04:00 UTC) | `scheduled` | `site_settings.verification.daily_budget` (10), at most 10 per invocation, within the time that is left of 60 seconds |
| The owner asks for a re-check in the dashboard | `maker_requested` | three a day per listing, six an hour per person; the run starts at once |
| A moderator starts a run in the admin area | `manual` | moderators only |

A listing that was never checked has no `next_check_at` and is first in line for the daily job.
Publishing a listing does not start a run by itself.

Sample listings (`is_demo`) are never verified: their sites do not exist.

## 8. Rules for requests to other sites

Every request goes through `safeFetch`:

- `http:` and `https:` only, default ports only, no credentials in the address.
- The host must resolve to public addresses. The check happens inside the connection, so a DNS
  answer cannot change between the check and the request.
- Redirects are followed by hand, at most four, and every hop is checked again. A redirect from
  `https:` to `http:` is refused.
- Time limit 8 seconds per request, 25 seconds per run; size limit 1.5 MB per response (less for
  robots.txt, manifest and security.txt).
- At most 12 documents and 16 requests per run.
- No cookies and no credentials are sent. The user agent is `PWANovaBot/1.0`.
- `robots.txt` is respected: rules for `PWANovaBot`, otherwise the rules for everybody.

## 9. Statements by vendors

- Only the verified owner's statement is shown, always with its label and a source address.
- Technical observations that PWANova makes at one address (`website_reachable`, `https`,
  `pwa_manifest`, `security_txt`) and facts that follow from the company record (`company_identified`,
  `company_country`, `eu_company`) cannot be stated by hand.
- Answers are chosen by their wording ("No training on customer data" / "Customer data may be used
  for training"), never by a bare yes or no.
- A vendor can retract a statement. The row stays in the history as retracted.
- When ownership is revoked, the former owner's statements stop counting.

## 10. Corrections

Every evidence page has "Report incorrect information". A report goes to the moderators. A
moderator can record a manual review (`admin_set_fact`) with the source and the reason; that is a
new entry in the history, and the audit log keeps the previous and the new value.

## 11. What PWANova does not do

- It does not assess whether a document is legally sufficient.
- It does not state that a product complies with the GDPR, the EU AI Act or any other rule.
- It does not test security, and it does not audit code.
- It does not conclude anything from the absence of a link.
- It does not log in to products and does not read anything that is not public.
- It does not use a language model to judge documents.

## 12. Known limits

- Documents are found from the start page only. A document that is linked from a second-level page
  is not found automatically; the vendor can state it.
- Sites that render their navigation in the browser only show no links to a reader of HTML. Their
  documents stay "not verified" until the vendor states them.
- The confirming passage shows that the page reads like the document. It does not show that the
  document is complete or current.
- The daily budget is small on purpose. With many listings the interval between checks grows; the
  age of every answer is visible.
