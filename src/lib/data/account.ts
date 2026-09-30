/* eslint-disable @typescript-eslint/no-explicit-any -- PostgREST rows are mapped to typed objects at this boundary */
import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured, showDemoData } from "@/lib/env"
import { mapCatalogApp } from "./catalog"
import type { CatalogApp } from "@/lib/v2/types"

type Row = any

export interface NotificationItem {
  id: string
  kind: "app_update" | "launch" | "claim" | "evidence" | "request_match" | "request_response" | "contact_shared" | "moderation" | "system"
  title: string | null
  link: string | null
  appName: string | null
  decision: string | null
  readAt: string | null
  createdAt: string
}

/** Unread in-app notifications of the signed-in person. RLS limits the rows to their own. */
export const getUnreadCount = cache(async (): Promise<number> => {
  if (!isSupabaseConfigured) return 0
  const sb = await createClient()
  const { count, error } = await sb.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null)
  if (error) return 0
  return count ?? 0
})

export async function getNotifications(limit = 50): Promise<NotificationItem[]> {
  if (!isSupabaseConfigured) return []
  const sb = await createClient()
  const { data } = await sb.from("notifications").select("id, kind, title, link, metadata, read_at, created_at, app:apps(name)")
    .order("created_at", { ascending: false }).limit(limit)
  return ((data ?? []) as Row[]).map((n) => ({
    id: n.id, kind: n.kind, title: n.title, link: n.link, appName: n.metadata?.app_name ?? n.app?.name ?? null,
    decision: n.metadata?.decision ?? null, readAt: n.read_at, createdAt: n.created_at,
  }))
}

async function catalogByIds(ids: string[]): Promise<CatalogApp[]> {
  if (!ids.length) return []
  const sb = await createClient()
  const { data } = await sb.from("catalog_apps").select("*").in("id", ids)
  const byId = new Map(((data ?? []) as Row[]).filter((r) => showDemoData || !r.is_demo).map((r) => [r.id as string, mapCatalogApp(r)]))
  return ids.map((id) => byId.get(id)).filter((a): a is CatalogApp => Boolean(a))
}

export async function getSavedCatalog(userId: string): Promise<CatalogApp[]> {
  if (!isSupabaseConfigured) return []
  const sb = await createClient()
  const { data } = await sb.from("favorites").select("app_id").eq("user_id", userId).order("created_at", { ascending: false }).limit(200)
  return catalogByIds(((data ?? []) as Row[]).map((f) => f.app_id))
}

export async function getFollowedCatalog(userId: string): Promise<CatalogApp[]> {
  if (!isSupabaseConfigured) return []
  const sb = await createClient()
  const { data } = await sb.from("follows").select("app_id").eq("user_id", userId).order("created_at", { ascending: false }).limit(200)
  return catalogByIds(((data ?? []) as Row[]).map((f) => f.app_id))
}

export interface SavedComparison { id: string; key: string; title: string | null; createdAt: string; apps: { slug: string; name: string }[] }
export async function getSavedComparisons(userId: string): Promise<SavedComparison[]> {
  if (!isSupabaseConfigured) return []
  const sb = await createClient()
  const { data } = await sb.from("comparisons").select("id, slug_key, title, created_at, items:comparison_apps(position, app:apps(slug, name))")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(50)
  return ((data ?? []) as Row[]).map((c) => ({
    id: c.id, key: c.slug_key, title: c.title, createdAt: c.created_at,
    apps: [...(c.items ?? [])].sort((a: Row, b: Row) => a.position - b.position).filter((i: Row) => i.app).map((i: Row) => ({ slug: i.app.slug, name: i.app.name })),
  }))
}

export interface ViewerAppState { myRating: number | null; favorited: boolean; following: boolean }
/** What the signed-in person has already done with one app. */
export async function getViewerAppState(appId: string, viewerId: string | null): Promise<ViewerAppState> {
  const empty = { myRating: null, favorited: false, following: false }
  if (!viewerId || !isSupabaseConfigured) return empty
  const sb = await createClient()
  const [rating, fav, follow] = await Promise.all([
    sb.from("ratings").select("rating").eq("app_id", appId).eq("user_id", viewerId).maybeSingle(),
    sb.from("favorites").select("id").eq("app_id", appId).eq("user_id", viewerId).maybeSingle(),
    sb.from("follows").select("app_id").eq("app_id", appId).eq("user_id", viewerId).maybeSingle(),
  ])
  return { myRating: rating.data?.rating ?? null, favorited: Boolean(fav.data), following: Boolean(follow.data) }
}

/** Ids of the apps the viewer saved, to mark cards in a list with one query. */
export const getSavedIds = cache(async (viewerId: string | null): Promise<Set<string>> => {
  if (!viewerId || !isSupabaseConfigured) return new Set()
  const sb = await createClient()
  const { data } = await sb.from("favorites").select("app_id").eq("user_id", viewerId).limit(1000)
  return new Set(((data ?? []) as Row[]).map((f) => f.app_id as string))
})

export async function isFollowingCategory(categoryId: string, viewerId: string | null): Promise<boolean> {
  if (!viewerId || !isSupabaseConfigured) return false
  const sb = await createClient()
  const { data } = await sb.from("category_follows").select("category_id").eq("category_id", categoryId).eq("user_id", viewerId).maybeSingle()
  return Boolean(data)
}

export interface ProfileInfo { displayName: string; bio: string; website: string; locale: string | null; username: string }
export async function getOwnProfile(userId: string): Promise<ProfileInfo | null> {
  if (!isSupabaseConfigured) return null
  const sb = await createClient()
  const { data } = await sb.from("profiles").select("username, display_name, bio, website, locale").eq("id", userId).maybeSingle()
  if (!data) return null
  return { username: data.username, displayName: data.display_name ?? data.username, bio: data.bio ?? "", website: data.website ?? "", locale: data.locale ?? null }
}
