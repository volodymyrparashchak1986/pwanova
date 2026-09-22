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

export async function adminAction(input: z.infer<typeof schema>): Promise<ActionResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return fail("Invalid action.")
  const ctx = await authed("admin", { max: 200, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const { data: profile } = await ctx.sb.from("profiles").select("role").eq("id", ctx.user.id).single()
  if (profile?.role !== "admin") return fail("Admin access required.")
  const { kind, id, reason } = parsed.data
  const { error } = await ctx.sb.rpc("moderate", { p_kind: kind, p_id: id, p_reason: cleanText(reason, 500) || null })
  if (error) return fail("Action failed. A reason is required for hiding, rejecting or suspending content.")
  revalidatePath("/", "layout")
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
  const { data: profile } = await ctx.sb.from("profiles").select("role").eq("id", ctx.user.id).single()
  if (profile?.role !== "admin") return fail("Admin access required.")
  const { error } = await ctx.sb.rpc("reassign_app_owner", { p_app_id: parsed.data.appId, p_username: parsed.data.targetUsername.toLowerCase(), p_reason: cleanText(parsed.data.reason, 500) })
  if (error) return fail("Reassignment failed. Check the username and provide a reason.")
  revalidatePath("/", "layout")
  return { ok: true, message: "Owner reassigned. Ownership and publication must be verified again." }
}
