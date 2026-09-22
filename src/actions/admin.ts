"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { authed, fail } from "./common"
import { cleanText } from "@/lib/security/sanitize"
import type { ActionResult } from "@/lib/types"

const schema = z.object({
  kind: z.enum(["approve", "reject", "hide", "suspend", "restore", "verify", "unverify", "feature", "unfeature", "remove_review", "resolve_report", "dismiss_report"]),
  id: z.string().uuid(),
  reason: z.string().max(500).optional(),
})

const TARGET_TYPE: Record<string, "app" | "review" | "report"> = {
  approve: "app", reject: "app", hide: "app", suspend: "app", restore: "app", verify: "app", unverify: "app", feature: "app", unfeature: "app",
  remove_review: "review", resolve_report: "report", dismiss_report: "report",
}

/**
 * Admin actions run with the admin's own session; RLS `is_admin()` policies enforce authority in the
 * database (this function is not itself a security boundary — it's a convenience wrapper, and every
 * write it makes is re-checked by Postgres). Every call is logged to `admin_actions` (append-only:
 * the table has no update/delete policy, see supabase/migrations/20260201000000_beta_hardening.sql).
 */
export async function adminAction(input: z.infer<typeof schema>): Promise<ActionResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return fail("Invalid action.")
  const ctx = await authed("admin", { max: 200, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const { kind, id, reason } = parsed.data
  const cleanReason = reason ? cleanText(reason, 500) || null : null

  const appPatch: Record<string, Record<string, unknown>> = {
    approve: { status: "published", moderation_note: null },
    reject: { status: "rejected", moderation_note: cleanReason },
    hide: { status: "hidden", moderation_note: cleanReason },
    suspend: { status: "suspended", moderation_note: cleanReason },
    restore: { status: "published", moderation_note: null },
    verify: { verification_status: "verified" },
    unverify: { verification_status: "unverified" },
    feature: { is_featured: true, featured_at: new Date().toISOString() },
    unfeature: { is_featured: false, featured_at: null },
  }
  let error
  if (kind in appPatch) ({ error } = await ctx.sb.from("apps").update(appPatch[kind]).eq("id", id))
  else if (kind === "remove_review") ({ error } = await ctx.sb.from("reviews").delete().eq("id", id))
  else ({ error } = await ctx.sb.from("reports").update({ status: kind === "resolve_report" ? "resolved" : "dismissed" }).eq("id", id))
  if (error) return fail("Action failed. Are you an admin?")

  await ctx.sb.from("admin_actions").insert({ admin_id: ctx.user.id, action: kind, target_type: TARGET_TYPE[kind], target_id: id, reason: cleanReason })
  revalidatePath("/admin")
  revalidatePath("/")
  return { ok: true, message: "Done." }
}

const reassignSchema = z.object({ appId: z.string().uuid(), targetUsername: z.string().min(3).max(32), reason: z.string().max(500).optional() })

/**
 * Dispute-resolution path: reassigning a *verified* owner is deliberately NOT part of the normal
 * Claim App flow (verifyClaim/claim_app_ownership refuse to touch an app that already has one) —
 * this dedicated, logged, admin-only action is the only way to move it, e.g. after a support ticket
 * proves the previous claim was fraudulent.
 */
export async function reassignOwner(input: z.infer<typeof reassignSchema>): Promise<ActionResult> {
  const parsed = reassignSchema.safeParse(input)
  if (!parsed.success) return fail("Enter the target developer's username.")
  const ctx = await authed("admin-reassign", { max: 30, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const { data: target } = await ctx.sb.from("profiles").select("id, username").eq("username", parsed.data.targetUsername.toLowerCase()).maybeSingle()
  if (!target) return fail("No user with that username.")
  const { data: app, error } = await ctx.sb.from("apps").update({ developer_id: target.id, ownership_status: "verified_owner", verification_status: "unverified", moderation_note: null }).eq("id", parsed.data.appId).select("slug").maybeSingle()
  if (error || !app) return fail("Action failed. Are you an admin?")
  await ctx.sb.from("app_claims").update({ status: "expired" }).eq("app_id", parsed.data.appId)
  await ctx.sb.from("admin_actions").insert({ admin_id: ctx.user.id, action: "reassign_owner", target_type: "app", target_id: parsed.data.appId, reason: cleanText(parsed.data.reason, 500) || `to @${target.username}` })
  revalidatePath("/admin")
  revalidatePath(`/apps/${app.slug}`)
  return { ok: true, message: `Ownership moved to @${target.username}. They'll need to re-verify for PWANova Verified.` }
}
