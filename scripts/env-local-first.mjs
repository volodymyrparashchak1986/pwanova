#!/usr/bin/env node
/**
 * Point .env.local at the LOCAL Supabase stack; park any cloud values in .env.cloud-diagnostics.
 *
 *   supabase start && npm run env:local
 *
 * Meant to be run by a human. It never prints secret values, only variable names.
 * - If .env.local currently targets a cloud project, its values are moved to .env.cloud-diagnostics
 *   (mode 600, gitignored, loaded only explicitly with `node --env-file=.env.cloud-diagnostics`).
 * - .env.local is then rewritten with the running local stack's URL and keys (mode 600).
 */
import { execFileSync } from "node:child_process"
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs"

const parse = (text) => Object.fromEntries(
  text.split(/\r?\n/).map((l) => l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^"|"$/g, "")]),
)
const hostOf = (url) => { try { return new URL(url ?? "").hostname } catch { return "" } }

const current = existsSync(".env.local") ? parse(readFileSync(".env.local", "utf8")) : {}
const host = hostOf(current.NEXT_PUBLIC_SUPABASE_URL)
const isLocal = host === "127.0.0.1" || host === "localhost"

if (host && !isLocal) {
  if (existsSync(".env.cloud-diagnostics")) {
    console.error("Refusing to overwrite .env.cloud-diagnostics: move it away first.")
    process.exit(2)
  }
  const ref = host.split(".")[0]
  const keep = ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET", "SUPABASE_DB_PASSWORD"].filter((k) => k in current)
  writeFileSync(".env.cloud-diagnostics", [
    `# CLOUD project ${ref}. Nothing loads this file automatically.`,
    "# Diagnostics:  node --env-file=.env.cloud-diagnostics --import tsx scripts/<script>.ts",
    `# Any WRITE additionally needs, for that one approved run: ALLOW_PRODUCTION_TARGET=${ref}`,
    "# Supabase CLI cloud commands: set -a; . ./.env.cloud-diagnostics; set +a",
    ...keep.map((k) => `${k}=${current[k]}`),
    "",
  ].join("\n"), { mode: 0o600 })
  chmodSync(".env.cloud-diagnostics", 0o600)
  console.log(`parked cloud values in .env.cloud-diagnostics (mode 600): ${keep.join(", ")}`)
}

let status
try {
  status = parse(execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }))
} catch {
  console.error("The local stack is not running: `supabase start` first.")
  process.exit(3)
}
const apiUrl = status.API_URL
const anon = status.ANON_KEY ?? status.PUBLISHABLE_KEY
const service = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY
if (!apiUrl || !anon || !service) {
  console.error("`supabase status -o env` did not report API_URL / ANON_KEY / SERVICE_ROLE_KEY.")
  process.exit(3)
}

writeFileSync(".env.local", `# LOCAL Supabase stack (supabase start). Safe to develop and test against.
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=${apiUrl}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}
SUPABASE_SERVICE_ROLE_KEY=${service}
DEMO_MODE=false
SHOW_DEMO_DATA=false
ALLOW_INDEXING=false
NEXT_PUBLIC_AUTH_GOOGLE=false
NEXT_PUBLIC_AUTH_GITHUB=false
CRON_SECRET=local-dev-only
`, { mode: 0o600 })
chmodSync(".env.local", 0o600)
console.log(`.env.local now targets ${hostOf(apiUrl)} (local). Next: supabase db reset --local && npm run verify:supabase`)
