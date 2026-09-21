"use client"

import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { track } from "@/lib/track"

/** Opens the live app in a new tab and logs an `open_app` event. Demo apps have no live site. */
export function OpenAppButton({ appId, url, size = "sm", from, label = "Open", variant = "default", demo }: {
  appId: string; url: string; size?: "sm" | "default" | "lg"; from?: string; label?: string; variant?: "default" | "secondary" | "outline"; demo?: boolean
}) {
  return (
    <Button
      size={size}
      variant={variant}
      className="rounded-full"
      nativeButton={false}
      render={<a href={url} target="_blank" rel="noopener noreferrer" onClick={() => track(appId, "open_app", from)} title={demo ? "Demo listing: this site does not exist" : undefined} />}
    >
      {label}{size !== "sm" && <ExternalLink className="size-4" />}
    </Button>
  )
}
