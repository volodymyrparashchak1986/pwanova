"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { authed, fail } from "./common"
import type { ActionResult } from "@/lib/types"

const schema = z.object({
  kind: z.enum(["approve", "hide", "suspend", "restore", "verify", "unverify", "feature", "unfeature", "remove_review", "resolve_report", "dismiss_report"]),
  id: z.string().uuid(),
})

/** Admin actions run with the admin's own session; RLS `is_admin()` policies enforce authority in the database. */
export async function adminAction(input: z.infer<typeof schema>): Promise<ActionResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return fail("Invalid action.")
  const ctx = await authed("admin", { max: 200, windowSeconds: 3600 })
  if (!ctx.ok) return fail(ctx.error)
  const { kind, id } = parsed.data

  const appPatch: Record<string, Record<string, unknown>> = {
    approve: { status: "published" },
    hide: { status: "hidden" },
    suspend: { status: "suspended" },
    restore: { status: "published" },
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
  revalidatePath("/admin")
  revalidatePath("/")
  return { ok: true, message: "Done." }
}
