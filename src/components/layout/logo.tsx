import { cn } from "@/lib/utils"

/** PWANova mark: a four-point "nova" spark inside a gradient tile. Original artwork. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-8", className)} aria-hidden>
      <defs>
        <linearGradient id="pn-g" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="oklch(0.56 0.23 280)" />
          <stop offset="1" stopColor="oklch(0.72 0.14 215)" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#pn-g)" />
      <path d="M20 7c.9 6.4 3.6 9.6 10 10.5-6.4.9-9.1 4.1-10 10.5-.9-6.4-3.6-9.6-10-10.5C16.4 16.6 19.1 13.4 20 7Z" fill="white" />
      <circle cx="30.5" cy="9.5" r="2" fill="white" fillOpacity=".7" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span className="text-lg">PWANova</span>
    </span>
  )
}
