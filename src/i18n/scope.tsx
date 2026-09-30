import { I18nExtend } from "./client"
import type { ScopedNamespace } from "./dictionaries"
import { getDictionary, getLocale } from "./server"

/** Ships the texts of page-specific forms with the page that renders them. Server component. */
export async function I18nScope({ namespaces, children }: { namespaces: ScopedNamespace[]; children: React.ReactNode }) {
  const t = getDictionary(await getLocale())
  const dictionary = Object.fromEntries(namespaces.map((ns) => [ns, t[ns]]))
  return <I18nExtend dictionary={dictionary}>{children}</I18nExtend>
}
