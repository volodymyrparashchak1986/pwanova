export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/** When false the app runs in read-only demo mode on fabricated seed data. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/** Search engines are kept out until you explicitly launch (set ALLOW_INDEXING=true). Demo data must never be indexed. */
export const allowIndexing = process.env.ALLOW_INDEXING === "true"

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")
