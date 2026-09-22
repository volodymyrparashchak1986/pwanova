# Closed-beta release checklist — 2026-09-22

Verified locally on 2026-09-23: typecheck, lint, 111 Node/PGlite tests, 39 Auth/PostgREST/Storage checks, 7 browser E2E scenarios, clean Postgres migration, seeded-schema upgrade and production build. Full evidence and limitations are in beta-audit.md. These results do not check off the production gates below.

This checklist refers only to branch `codex/closed-beta-verification`. Earlier production claims are not evidence for this work. See beta-audit.md for executed checks and remaining limitations.

## Required before inviting the pilot

- [ ] Review and approve the PR; no automatic merge or production deployment.
- [ ] Back up the target database and test the migration on an explicitly authorized staging copy. This task changed only local databases.
- [ ] Check canonical URL collisions before creating the unique expression index. The migration fails rather than deleting duplicates. Resolve ownership ambiguities administratively.
- [ ] Apply `20260922213419_closed_beta_integrity.sql` only after separate authorization. Coordinate application release: the old unchecked claim RPC signature is intentionally removed.
- [ ] Set real environment values; `DEMO_MODE=false`, `SHOW_DEMO_DATA=false`, `ALLOW_INDEXING=false`. Never seed production.
- [ ] Provision admin explicitly and verify its account; the first signup never becomes admin.
- [ ] Test real email magic-link delivery and allowed callback URLs. OAuth buttons remain hidden until enabled and verified.
- [ ] Publish a real verification file on an app origin you control; test success, wrong contents, expiry, restart and attempted redirect. Synthetic transport tests do not prove a real public deployment.
- [ ] Verify trusted proxy forwarding headers and shared DB rate-limit RPC; production fails closed on rate-limit backend errors.
- [ ] Run physical iPhone/Android checklist in beta-pilot.md. Desktop emulation is insufficient.
- [ ] Obtain consent from 10 developers and 2 launch boards; these remain pilot goals, not achieved metrics.
- [ ] For a consenting board, create an active partner and assign `partner_members` as admin. Its authenticated user sees only its aggregate metrics on /partners.
- [ ] Confirm moderation staffing, review rules, reporting, retention and privacy wording for the pilot.
- [ ] Verify the existing daily Vercel cron, its CRON_SECRET and successful retention runs. Raw events have a 180-day default retention helper; declared configuration alone is not evidence that production runs it.

## Reproduce local verification

- [ ] `npm ci`; start Docker; `supabase start` (isolated pwanova-beta-local, ports 55320–55329).
- [ ] Put only local Supabase keys in ignored `.env.local`; set local URL and both demo flags false.
- [ ] `npm run typecheck && npm run lint && npm test`
- [ ] `npm run verify:supabase` (hard-restricted to localhost).
- [ ] `npx playwright install chromium && npm run test:e2e`
- [ ] `npm run build` — build only; does not deploy.

## Manual checks not claimed as automated proof

- [ ] Real iPhone safe areas, keyboard, install flow and standalone launch.
- [ ] Android browser variants and install fallback when unavailable.
- [ ] App-origin ownership file over real HTTPS, with real TLS/DNS behavior.
- [ ] Real provider OAuth and SMTP delivery.
- [ ] Consent-based partner installation on its own website.
- [ ] Production rollout, cache invalidation of any *old* CDN objects, and service-worker upgrade from the previous deployed version. New responses use no-store, but old cached responses must be invalidated during release.
