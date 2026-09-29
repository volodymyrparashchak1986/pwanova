import type { Json } from "@/lib/database.types"

/**
 * A database function accepts NULL for any argument, but the generated types only carry the declared
 * type. Leaving the key out is not the same thing: PostgREST would then look for a function without it.
 */
export const nullable = <T>(value: T | null | undefined): T => (value ?? null) as T

/** Structured data for a json/jsonb column or argument. */
export const asJson = (value: unknown): Json => value as Json
