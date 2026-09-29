import { getI18n } from "@/i18n/server"
import { isSupabaseConfigured, demoMode } from "@/lib/env"

export async function DemoBanner() {
  if (isSupabaseConfigured) return null
  const { t } = await getI18n()
  if (!demoMode) return <div role="status" className="bg-muted p-2 text-center text-sm">{t.common.configMissing}</div>
  return <div className="bg-accent px-4 py-1.5 text-center text-xs text-accent-foreground">{t.common.demoMode}</div>
}
