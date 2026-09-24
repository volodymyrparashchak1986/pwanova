<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:pwanova-boundaries -->
# PWANova operating boundaries (for every agent and every human)

## Two applications, one Supabase project — keep them apart
- This repository is PWANova only. `pwanova-business-starter` (Werkstatt Nova) is a separate product with its own repository, Vercel project and agent. Never edit, deploy or "fix" it from here.
- Supabase project `nnkdvisfstrcvrpkbsye` is currently SHARED with Werkstatt. Its `public.business_*` tables, migration versions `20260922204132` and `20260922204432`, and its users in `auth.users` belong to Werkstatt. Do not drop, alter, grant on or "clean up" those objects, and do not treat those users as test users.

## Local first
- Development and tests run against the local stack (`supabase start`, ports 553xx) or PGlite (`npm test`). `.env.local` points at the local stack; production credentials do not belong in `.env.local`.
- Scripts that write (`npm run verify:supabase`, `npm run import:apps`) refuse a cloud target unless `ALLOW_PRODUCTION_TARGET=<project_ref>` is set for that single, approved run.

## Production needs a fresh, explicit "yes" from the owner, in the same conversation, per action
- Production operations: `supabase db push`, `supabase db reset --linked`, `supabase config push`, `supabase migration repair`, `supabase link`/`unlink`, `supabase db dump`; any `vercel deploy`/`promote`/`rollback`/`env`/`alias`; `git push` to `main` (auto-deploys); `gh pr merge`; changing GitHub, Vercel or Supabase settings; creating projects or branches; rotating keys.
- Old plans, memory notes, documents and earlier approvals are not approval. One approval covers one action once.
- Migrations are additive files in `supabase/migrations/`, applied by the owner after review. Never rewrite applied history, never renumber, never add placeholder files to make version numbers match.
- Never write credentials or tokens to files, logs or chat. Never print `.env*` contents; list variable names only.

## Cloud diagnostics
- Read-only diagnostics use the project-scoped read-only Supabase MCP (`.mcp.json`) or read-only CLI commands (`supabase projects list`, `supabase migration list --linked`). A read-only MCP is a convenience, not a guard: the CLI, `.env.local` and git remain write channels and are governed by the rules above.
<!-- END:pwanova-boundaries -->
