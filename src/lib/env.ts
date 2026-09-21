export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/** When false the app runs in read-only demo mode on fabricated seed data. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")
