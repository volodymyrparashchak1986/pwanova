import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-6xl font-semibold text-brand-gradient">404</p>
      <h1 className="mt-4 text-2xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-muted-foreground">The app or page may have moved, been hidden, or never existed.</p>
      <Link href="/explore" className={cn(buttonVariants({ size: "lg" }), "mt-6 rounded-full")}>Explore apps</Link>
    </div>
  )
}
