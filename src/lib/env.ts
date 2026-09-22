export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/** Connection availability only; missing credentials never enable production demo data. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/** Search engines are kept out until you explicitly launch (set ALLOW_INDEXING=true). Demo data must never be indexed. */
export const allowIndexing = process.env.ALLOW_INDEXING === "true"

/** Demo rows require an explicitly enabled demo deployment; normal public surfaces exclude them. */
export const demoMode = process.env.DEMO_MODE === "true" || (process.env.NODE_ENV !== "production" && process.env.DEMO_MODE !== "false")
export const showDemoData = demoMode && process.env.SHOW_DEMO_DATA === "true"

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")
