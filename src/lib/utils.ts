import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Reads a key that came from outside (an address, a form, a stored row): own keys only, never the prototype's. */
export const own = <T>(record: Record<string, T>, key: string): T | undefined => (Object.hasOwn(record, key) ? record[key] : undefined)

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
