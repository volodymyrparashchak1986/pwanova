"use client"

import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n/client"

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const { t } = useI18n()
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">{t.errors.errorTitle}</h1>
      <p className="mt-2 text-muted-foreground">{t.errors.errorBody}</p>
      <Button size="lg" className="mt-6 rounded-full" onClick={reset}>{t.common.tryAgain}</Button>
    </div>
  )
}
