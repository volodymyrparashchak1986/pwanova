import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

const control = "w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60"

/** Label, control and hint as one unit. The hint is tied to the control for screen readers. */
export function Field({ label, hint, optional, children, className }: { label: string; hint?: string; optional?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="mb-1.5 flex items-baseline gap-2 font-medium">{label}{optional && <span className="text-xs font-normal text-muted-foreground">{optional}</span>}</span>
      {children}
      {hint && <span className="mt-1 block text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  )
}

export const TextInput = ({ className, ...props }: ComponentProps<"input">) => <input {...props} className={cn(control, "h-11", className)} />
export const TextArea = ({ className, ...props }: ComponentProps<"textarea">) => <textarea {...props} className={cn(control, "min-h-24 py-2.5", className)} />
export const SelectInput = ({ className, children, ...props }: ComponentProps<"select">) => <select {...props} className={cn(control, "h-11", className)}>{children}</select>

export function Fieldset({ legend, hint, children, className }: { legend: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <fieldset className={cn("rounded-3xl border border-border bg-card p-5 md:p-6", className)}>
      <legend className="float-left mb-1 w-full text-lg font-semibold">{legend}</legend>
      {hint && <p className="clear-both text-sm text-muted-foreground">{hint}</p>}
      <div className="clear-both mt-4 grid gap-4">{children}</div>
    </fieldset>
  )
}

export interface Choice { value: string; label: string }

/** Checkbox list for a small set of choices. `max` stops further ticks instead of failing on submit. */
export function CheckList({ name, choices, values, onChange, max, columns = 2 }: { name: string; choices: Choice[]; values: string[]; onChange: (next: string[]) => void; max?: number; columns?: 2 | 3 }) {
  return (
    <ul className={cn("grid gap-x-4 gap-y-1", columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2")}>
      {choices.map((c) => {
        const on = values.includes(c.value)
        const blocked = !on && max !== undefined && values.length >= max
        return (
          <li key={c.value}>
            <label className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-sm hover:bg-muted/70", blocked && "cursor-not-allowed opacity-50")}>
              <input type="checkbox" name={name} value={c.value} checked={on} disabled={blocked} className="size-4 shrink-0 rounded border-border accent-[var(--brand)]"
                onChange={() => onChange(on ? values.filter((v) => v !== c.value) : [...values, c.value])} />
              <span>{c.label}</span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}
