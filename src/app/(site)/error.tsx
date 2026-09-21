"use client"

import { Button } from "@/components/ui/button"

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-muted-foreground">Please try again. If it keeps happening, let us know.</p>
      <Button size="lg" className="mt-6 rounded-full" onClick={reset}>Try again</Button>
    </div>
  )
}
