export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/** When false the app runs in read-only demo mode on fabricated seed data. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/** Search engines are kept out until you explicitly launch (set ALLOW_INDEXING=true). Demo data must never be indexed. */
export const allowIndexing = process.env.ALLOW_INDEXING === "true"

/**
 * Server-only switch (no NEXT_PUBLIC_ prefix on purpose). Off by default.
 * `is_demo` rows may exist in a real Supabase project (e.g. a seeded staging/demo environment) without
 * this being a "demo mode" build. When this is false, every listing/search/ranking/sitemap/partner-API
 * query excludes is_demo rows, so fabricated data can never surface as real ratings, installs or SEO
 * structured data. A demo app's own page and its embed/badge stay reachable by direct link (useful for
 * showing the Partner Kit) but are always labelled "Demo data" and kept out of the public API.
 */
export const showDemoData = process.env.SHOW_DEMO_DATA === "true"

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")
