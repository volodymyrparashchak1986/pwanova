/**
 * Target guard for scripts that WRITE through the service role.
 *
 * Local Supabase stacks (127.0.0.1 / localhost) are always allowed. Any cloud project is refused
 * unless the operator names it explicitly for this single run:
 *
 *   ALLOW_PRODUCTION_TARGET=<project_ref> npm run <script> -- ...
 *
 * The ref must match the host of NEXT_PUBLIC_SUPABASE_URL, so a stale variable copied from another
 * shell cannot silently authorise a different project.
 */
export function assertAllowedTarget(supabaseUrl: string | undefined, purpose: string): void {
  let host = ""
  try { host = new URL(supabaseUrl ?? "").hostname.toLowerCase() } catch { /* handled below */ }
  if (!host) {
    console.error(`${purpose}: NEXT_PUBLIC_SUPABASE_URL is missing or invalid.`)
    process.exit(2)
  }
  if (host === "127.0.0.1" || host === "localhost" || host === "::1") return
  const ref = host.split(".")[0]
  if (process.env.ALLOW_PRODUCTION_TARGET === ref) {
    console.warn(`WARNING ${purpose}: writing to CLOUD project ${ref} (explicitly allowed for this run).`)
    return
  }
  console.error(
    `${purpose}: refusing to write to ${host}.\n` +
    `Point NEXT_PUBLIC_SUPABASE_URL at the local stack (supabase start), or, for one approved run only, set ALLOW_PRODUCTION_TARGET=${ref}.`,
  )
  process.exit(3)
}
