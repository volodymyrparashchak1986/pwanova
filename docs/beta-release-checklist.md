# Beta release checklist

Use this right before inviting the pilot group (`docs/beta-pilot.md`) and again before any wider launch. Checked items were verified on the `beta/hardening` branch this session (see `docs/beta-audit.md` for how); unchecked items need the project owner, because they need real credentials, a real device, or a decision this session isn't authorized to make alone.

## Code quality (done, this session)

- [x] `npm run typecheck` — clean
- [x] `npm run lint` — clean
- [x] `npm test` — 86/86 passing (real migrations + seed replayed on PGlite; see `tests/db.test.ts`, `tests/lib.test.ts`, `tests/install-dialog.test.ts`)
- [x] `npm run build` — clean, both with and without Supabase env vars set (demo mode must build too)
- [x] No secrets in the diff, logs or these docs (checked by hand; nothing in this branch touches `.env.local`)

## Database (done, local verification; owner applies to the real project)

- [x] New migration `supabase/migrations/20260201000000_beta_hardening.sql` is additive only — no existing migration edited, no data deleted, no destructive `ALTER`/`DROP` of existing columns.
- [x] Applies cleanly on top of the existing four migrations, replayed from scratch (`npm test`'s `before()` hook does exactly this every run).
- [x] Applied to the real project on 2026-09-22 (`supabase db push`, one migration, clean).
- [x] `npm run verify:supabase` run against that project right after: 36/36 passing.

## Security (done, this session, re-verify live per above)

- [x] RLS covers every table; ownership/verification/featured/role/trust-flag columns are locked against their own row's owner, not just other users (`tests/db.test.ts`).
- [x] Self-rating/self-review blocked at the database level, not just in the UI (new this branch).
- [x] Ownership assignment is atomic; cannot replace an existing verified owner (new this branch).
- [x] SSRF protections unchanged and still in place (`src/lib/security/ssrf.ts`): scheme/port allow-list, private/loopback/link-local/CGNAT blocked for IPv4 and IPv6, DNS re-checked inside the socket lookup, redirects re-validated per hop, size/time capped, no cookies/credentials forwarded.
- [x] Rate limiting is DB-backed (shared across serverless instances) whenever `SUPABASE_SERVICE_ROLE_KEY` is set, which every real deployment needs anyway.
- [x] The install-dialog bug that could install PWANova instead of a listed app is fixed (`docs/beta-audit.md`, P0-3).
- [x] GitHub OAuth provider configured on the project and confirmed live (`/auth/v1/authorize?provider=github` redirects to GitHub with the real client id); the owner signed in end to end via magic link, which exercises the same `/auth/callback` exchange. **Owner:** Google is not configured (needs a Google Cloud OAuth client); optional for the pilot.

## Data integrity (done, this session)

- [x] One rating + at most one review per `(app, user)`; a review always keeps its rating in sync; deleting a review doesn't delete the rating.
- [x] Fabricated demo data excluded from every public listing, search, ranking, sitemap and the partner API unless `SHOW_DEMO_DATA=true` (new this branch; default is `false`).
- [x] Demo apps never emit `aggregateRating` (or any) JSON-LD structured data (new this branch).
- [x] Ranking cannot be won by a single 5-star rating (confidence-weighted formula, tested both in SQL and against the TypeScript mirror).
- [x] Demo data removed from the live project on 2026-09-22 (all `is_demo` apps, the seeded demo partner rows and the 70 fabricated auth users). The Partner Kit's worked example no longer needs a database row — it renders a static in-code sample (`src/lib/partner-example.ts`, slug `_example`, always marked "demo data").

## Moderation (done, this session)

- [x] Approve/reject-with-reason queue, separate from ownership verification.
- [x] Suspending/hiding/rejecting an app removes it from the catalog, search, sitemap, the public API, the iframe embed and the SVG badge alike (all read `apps_public`, which filters to `status = 'published'`).
- [x] Every admin action is logged (`admin_actions`, append-only — no UPDATE/DELETE policy exists on it, including for admins).
- [x] Disputed-ownership reassignment is a separate, logged, reasoned action — not something the normal Claim App flow can ever do.
- [x] The owner's account (`volodymyrparashchak1986`) is the only admin. **Owner:** name anyone else who should be, before the pilot starts.

## Partner Kit (done, this session, in demo mode; live-checked separately by owner)

- [x] Public API returns only public fields, includes check statuses / last-checked time / install-guidance / badge / embed links, and `rating: null` (not `0`) when there are no ratings yet.
- [x] SVG badge endpoint (`/api/badge/[slug]`), XML-escaped, accessible, no tracking JS required.
- [x] `/partners` has a live snippet generator (iframe and plain-image formats) and `/partners/demo`, a clearly-labelled fictional worked example.
- [x] Suspended/hidden/pending/rejected apps 404 in the API, the badge and the embed alike.
- [ ] **Owner:** the two real partner integrations from `docs/beta-pilot.md`.

## Mobile

- [x] Emulated mobile viewport pass this session: app page, claim page, install dialog, review form, no horizontal overflow, safe-area classes present on the header/bottom nav.
- [ ] **Owner:** real-device checklist in `docs/beta-pilot.md` (iPhone Safari + Android Chrome) — an emulator is not proof.

## Content & policy

- [x] No "production-ready", "safe", "malware-free" or "security verified" claims anywhere in the UI copy (checked by grep).
- [x] No claim that PWANova is affiliated with, endorsed by, or the same company as Vercel, v0, Product Hunt or any other named service — all such names appear only as neutral attribution badges.
- [x] No claim that a trademark is registered or that legal clearance is complete (none was claimed to begin with).
- [ ] **Owner:** decide the license for the public GitHub repo, if any (currently none is declared).

## Launch gating (unchanged from before this branch, confirm still set correctly)

- [x] `ALLOW_INDEXING=false` — confirmed on the production deployment (2026-09-22).
- [x] `SHOW_DEMO_DATA=false` — set explicitly on the production deployment (2026-09-22).
- [x] `SUBMIT_REQUIRES_APPROVAL=true` — set on the production deployment for the pilot (2026-09-22): every new submission now waits in `/admin`'s pending queue.

## This session's process constraints (for the record)

Per this stage's instructions, nothing on this branch touched the production database, ran a production migration, merged to `main`, deployed, connected a paid service, created a new paid project, or registered a domain. All verification ran locally: `npm test` against a disposable in-process Postgres, and a manually-started dev server with Supabase credentials deliberately unset (demo mode), never against the linked Supabase project. A pull request was opened for review; it was not merged.
