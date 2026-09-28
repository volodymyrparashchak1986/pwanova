/**
 * In-process Postgres (PGlite) with the extensions the migrations need.
 * Supabase-managed pieces (auth schema, roles) are stubbed in tests/supabase-prelude.sql.
 */
import { readdirSync, readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm"
import { unaccent } from "@electric-sql/pglite/contrib/unaccent"

const root = new URL("../../", import.meta.url)
export const read = (path: string) => readFileSync(new URL(path, root), "utf8")
export const migrationFiles = () => readdirSync(new URL("supabase/migrations/", root)).sort()

/** First migration that belongs to V2; everything before it is the v1 schema production ran until 2026-09. */
export const FIRST_V2_MIGRATION = "20260929100000_v2_foundation.sql"

export async function createDb(opts: { upTo?: string; seed?: boolean } = {}): Promise<PGlite> {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } })
  await db.exec(read("tests/supabase-prelude.sql"))
  for (const f of migrationFiles()) {
    if (opts.upTo && f >= opts.upTo) break
    await applyMigration(db, f)
  }
  if (opts.seed !== false) await db.exec(read("supabase/seed.sql"))
  return db
}

export async function applyMigration(db: PGlite, file: string) {
  try {
    await db.exec(read(`supabase/migrations/${file}`))
  } catch (e) {
    throw new Error(`${file}: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/** Seed identities used across the database tests (see supabase/seed.sql). */
export const ids = {
  novalabs: "20000000-0000-4000-8000-000000000001", // verified owner of metro-fit
  marina: "20000000-0000-4000-8000-000000000003", // verified owner of invoicelite
  oak: "20000000-0000-4000-8000-000000000005", // submitted mealcraft, ownership not verified
  rater1: "10000000-0000-4000-8000-000000000060",
  rater2: "10000000-0000-4000-8000-000000000061",
  rater3: "10000000-0000-4000-8000-000000000062",
  metroFit: "40000000-0000-4000-8000-000000000001",
  invoicelite: "40000000-0000-4000-8000-000000000003",
  mealcraft: "40000000-0000-4000-8000-000000000004",
}

/** Helpers bound to one database: run SQL the way PostgREST would, as a user, anon or the service role. */
export function session(db: PGlite) {
  const q = async <T = Record<string, unknown>>(sql: string) => (await db.query<T>(sql)).rows
  async function as<T>(who: string | "anon" | "service", fn: () => Promise<T>): Promise<T> {
    const role = who === "anon" ? "anon" : who === "service" ? "service_role" : "authenticated"
    const sub = who === "anon" || who === "service" ? "" : who
    await db.exec(`select set_config('request.jwt.claim.sub', '${sub}', false); select set_config('request.jwt.claim.role', '${role}', false); set role ${role};`)
    try { return await fn() } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claim.role', '', false);") }
  }
  return { q, as }
}
