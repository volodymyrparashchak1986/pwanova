import { LogIn } from "lucide-react"
import { Link } from "@/components/i18n/link"
import { buttonVariants } from "@/components/ui/button"
import { getI18n } from "@/i18n/server"
import { isSupabaseConfigured } from "@/lib/env"
import { cn } from "@/lib/utils"

/** `next` is a path without language prefix; the sign-in page returns the visitor to it in their language. */
export async function SignedOutCard({ title, body, next }: { title: string; body: string; next: string }) {
  const { t, href } = await getI18n()
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand/10 text-brand"><LogIn className="size-5" aria-hidden /></div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      {isSupabaseConfigured
        ? <Link href={`/sign-in?next=${encodeURIComponent(href(next))}`} className={cn(buttonVariants({ size: "lg" }), "mt-6 rounded-full")}>{t.common.signIn}</Link>
        : <p className="mt-5 rounded-xl bg-muted p-3 text-xs text-muted-foreground">{t.common.demoNoAccounts}</p>}
    </div>
  )
}
