import { hueFor } from "@/lib/format"
import { cn } from "@/lib/utils"

const SIZES = { sm: "size-12 rounded-[14px] text-lg", md: "size-16 rounded-[18px] text-xl", lg: "size-24 rounded-[26px] text-3xl", xl: "size-28 rounded-[30px] text-4xl" }

/** App icon with generated gradient fallback. If the remote image fails, the tile underneath stays visible. */
export function AppIcon({ app, size = "md", className }: { app: { name: string; slug: string; iconUrl: string | null }; size?: keyof typeof SIZES; className?: string }) {
  const h = hueFor(app.slug)
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden font-semibold text-white shadow-soft ring-1 ring-black/5", SIZES[size], className)}
      style={{ backgroundImage: `linear-gradient(135deg, oklch(0.62 0.19 ${h}), oklch(0.5 0.2 ${(h + 45) % 360}))` }}
      aria-hidden
    >
      {app.name.slice(0, 1).toUpperCase()}
      {app.iconUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- remote user icons; failure falls back to the tile
        <img src={app.iconUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="absolute inset-0 size-full bg-card object-cover" />
      )}
    </span>
  )
}
