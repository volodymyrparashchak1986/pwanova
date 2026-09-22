import { isSupabaseConfigured, demoMode } from "@/lib/env"

export function DemoBanner() {
  if (isSupabaseConfigured) return null
  if (!demoMode) return <div role="status" className="bg-muted p-2 text-center text-sm">Service configuration is incomplete. Catalog data is unavailable.</div>
  return (
    <div className="bg-accent px-4 py-1.5 text-center text-xs text-accent-foreground">
      <span className="sm:hidden">Demo mode: sample data. Connect Supabase to enable accounts.</span><span className="hidden sm:inline">Demo mode: showing fabricated sample apps. Sign-in, ratings and reviews activate once Supabase is connected (see README).</span>
    </div>
  )
}
