import Link from "next/link"
import { LogIn } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { isSupabaseConfigured } from "@/lib/env"
import { cn } from "@/lib/utils"

export function SignedOutCard({ title, body, next }: { title: string; body: string; next: string }) {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand/10 text-brand"><LogIn className="size-5" /></div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      {isSupabaseConfigured
        ? <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className={cn(buttonVariants({ size: "lg" }), "mt-6 rounded-full")}>Sign in</Link>
        : <p className="mt-5 rounded-xl bg-muted p-3 text-xs text-muted-foreground">Demo mode: connect Supabase to enable accounts (see README).</p>}
    </div>
  )
}
