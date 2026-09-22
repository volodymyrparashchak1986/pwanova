# Production release — 2026-09-23 Europe/Berlin

The owner explicitly requested production deployment. Existing Vercel project `pwanova` (GASTROCRAFT) and Supabase project `nnkdvisfstrcvrpkbsye` were reused. No new paid projects, domains, emails or seed data were created.

- Live URL: https://pwanova.vercel.app
- Deployment: `dpl_6MDSD1WrDXeqCJShW4z4tayPctLx`
- Deployment URL: https://pwanova-2s0ohvol5-gastrocraft.vercel.app
- Application commit: `1ec24d41c7d0d85a7c1d708f49d071926ebca1f6` from `codex/closed-beta-verification`.
- PR: https://github.com/volodymyrparashchak1986/pwanova/pull/2 remains open; no merge into main was needed to deploy.
- Vercel remote production build passed, staged with `--skip-domain`, then promoted after the database migration succeeded.

## Database and migration history

Schema and data (public, auth, storage metadata and migration history) were dumped before DDL into a local private directory with owner-only file permissions. Storage object file contents were not exported. A complete restore of this production dump was not rehearsed. Clean PostgreSQL migration and seeded-schema upgrade tests had already passed locally; the upgrade test passed again after the migration filename was aligned.

Supabase applied `closed_beta_integrity` successfully and assigned version `20260922222344`. The identical SQL file in this PR was renamed from its earlier local version `20260922213419` to match that recorded version. A proposed production history UPDATE was rejected by automatic approval review; it was not executed or retried. Production history was preserved as issued by Supabase.

Counts before and after: profiles 2; apps 0; business_services 4. Existing business starter tables were retained. There were no app URL collisions because the app table was empty.

The shared database also has `deployment_hardening` and `restrict_business_grants` migrations belonging to the business starter. They are not part of this platform repository. Do not blindly run `db push` or migration repair against the shared project: inspect the combined history and apply only reviewed pending SQL through the migration tool.

## Production checks actually performed

- `/`, `/explore`, `/sign-in`, `/partners`, `/partners/demo`: HTTP 200.
- `/dashboard`: HTTP 200 with the signed-out access card; no private metrics for guests.
- Unknown app: public API, badge and embed return 404 with no-store responses.
- Partner example badge/embed are explicitly marked demo; no fake catalog entries were inserted.
- `robots.txt`: `Disallow: /`; indexing remains disabled for the beta.
- Production site and Supabase origins matched the intended project. `SHOW_DEMO_DATA=false`, `ALLOW_INDEXING=false`; absent `DEMO_MODE` defaults false in production. Local env files were excluded by `.vercelignore`; Vercel used its existing production secrets.
- Chromium at 375×812: home, explore, partners, partner demo, sign-in and signed-out dashboard loaded without JavaScript page errors or horizontal overflow. Home screenshot inspected.
- Vercel error-log query for the new deployment returned no error entries during the immediate smoke-check window; this is not ongoing monitoring.

## Advisor findings and remaining gates

Supabase advisor still reports the intentional SECURITY DEFINER public aggregate view and authenticated RPCs, trigger-function grants, mutable function search_path warnings, and disabled leaked-password protection. Trigger functions are not directly callable as ordinary RPCs. The aggregate view exposes an explicit published-only projection, and privileged RPCs perform role/ownership checks covered by the local tests. This is not a claim that the advisor report is clean. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view and https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable.

Real email delivery, real public HTTPS ownership-file success, signed-in production end-to-end scenarios, physical iPhone/Android installation, old service-worker upgrade, production cron execution and consenting partner integrations were not verified in this release. No destructive test fixtures or local verification scripts were run against production. See beta-pilot.md and beta-release-checklist.md before inviting the pilot.

The catalog currently has zero real applications. Earlier results (111 unit/PGlite, 39 local Supabase checks and 7 E2E scenarios, plus typecheck/lint/build and GitHub CI) remain local/CI evidence, not production user tests.

Rollback needs code/database compatibility review: the previous unchecked claim RPC signature was removed. Do not blindly promote an old application build or restore the shared database over newer user data.
