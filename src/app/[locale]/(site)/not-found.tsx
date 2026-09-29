import { Link } from "@/components/i18n/link"
import { buttonVariants } from "@/components/ui/button"
import { getI18n } from "@/i18n/server"
import { cn } from "@/lib/utils"

export default async function NotFound() {
  const { t } = await getI18n()
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-6xl font-semibold text-brand-gradient">404</p>
      <h1 className="mt-4 text-2xl font-semibold">{t.errors.notFoundTitle}</h1>
      <p className="mt-2 text-muted-foreground">{t.errors.notFoundBody}</p>
      <Link href="/discover" className={cn(buttonVariants({ size: "lg" }), "mt-6 rounded-full")}>{t.errors.notFoundCta}</Link>
    </div>
  )
}
