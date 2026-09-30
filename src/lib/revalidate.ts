import "server-only"
import { revalidatePath } from "next/cache"
import { LOCALES } from "@/i18n/config"

/** Revalidate a page in every language. `path` has no locale prefix, e.g. "/apps/excalidraw". */
export function revalidateLocalized(...paths: string[]) {
  for (const path of paths) {
    for (const locale of LOCALES) revalidatePath(path === "/" ? `/${locale}` : `/${locale}${path}`)
  }
}
