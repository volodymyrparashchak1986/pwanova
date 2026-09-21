import { WifiOff } from "lucide-react"
import { LogoMark } from "@/components/layout/logo"

export const metadata = { title: "Offline", robots: { index: false } }

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
      <LogoMark className="size-14" />
      <WifiOff className="mt-8 size-8 text-muted-foreground" />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">You&apos;re offline</h1>
      <p className="mt-2 text-muted-foreground">PWANova needs a connection to load apps and reviews. Reconnect and try again.</p>
    </main>
  )
}
