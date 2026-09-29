"use client"

import { useMemo, useState } from "react"
import { Copy } from "lucide-react"
import { toast } from "sonner"
import { useI18n } from "@/i18n/client"
import { LOCALES, type Locale } from "@/i18n/config"
import { fmt } from "@/i18n/format"
import { siteUrl } from "@/lib/env"
import { isExampleSlug } from "@/lib/partner-example"

function CopyBlock({ code }: { code: string }) {
  const { t } = useI18n("partners")
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-2xl bg-[oklch(0.17_0.03_275)] p-5 pr-12 text-[13px] leading-relaxed text-white/90"><code>{code}</code></pre>
      <button type="button" aria-label={t.partners.kit.copy} onClick={() => { navigator.clipboard.writeText(code).then(() => toast.success(t.partners.kit.copied)).catch(() => toast.error(t.partners.kit.copyFailed)) }} className="absolute top-4 right-4 rounded-lg bg-white/10 p-1.5 text-white/80 hover:bg-white/20"><Copy className="size-4" /></button>
    </div>
  )
}

/** Live snippet generator for launch boards: iframe or plain image, theme and language. */
export function PartnerKit({ apps, refCode }: { apps: { slug: string; name: string }[]; refCode?: string }) {
  const { t, locale } = useI18n("partners")
  const k = t.partners.kit
  const [slug, setSlug] = useState(apps[0]?.slug ?? "")
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [format, setFormat] = useState<"iframe" | "image">("iframe")
  const [lang, setLang] = useState<Locale>(locale)
  const ref = refCode ? `?ref=${encodeURIComponent(refCode)}` : ""
  // the fictional sample has no app page of its own; its badge links back to the worked example
  const canonical = isExampleSlug(slug) ? `${siteUrl}/${lang}/partners/demo${ref}` : `${siteUrl}/${lang}/apps/${slug}${ref}`
  const query = `theme=${theme}&lang=${lang}${refCode ? `&ref=${encodeURIComponent(refCode)}` : ""}`

  const snippet = useMemo(() => {
    if (format === "iframe") {
      return `<iframe src="${siteUrl}/embed/app/${slug}?${query}"\n        width="260" height="72" style="border:0" loading="lazy"\n        title="${slug} · PWANova"></iframe>`
    }
    return `<a href="${canonical}" target="_blank" rel="noopener">\n  <img src="${siteUrl}/api/badge/${slug}?${query}"\n       width="220" height="60" alt="${k.viewOn}" loading="lazy">\n</a>`
  }, [slug, format, canonical, query, k.viewOn])

  const selectCls = "h-9 rounded-lg border border-input bg-background px-2.5 text-sm"
  return (
    <div className="space-y-4 rounded-3xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <select className={selectCls} value={slug} onChange={(e) => setSlug(e.target.value)} aria-label={k.app}>
          {apps.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
        </select>
        <select className={selectCls} value={format} onChange={(e) => setFormat(e.target.value as typeof format)} aria-label={k.format}>
          <option value="iframe">{k.iframe}</option>
          <option value="image">{k.image}</option>
        </select>
        <select className={selectCls} value={theme} onChange={(e) => setTheme(e.target.value as typeof theme)} aria-label={k.theme}>
          <option value="light">{k.light}</option>
          <option value="dark">{k.dark}</option>
        </select>
        <select className={selectCls} value={lang} onChange={(e) => setLang(e.target.value as Locale)} aria-label={k.language}>
          {LOCALES.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
        </select>
      </div>

      <div className="flex min-h-[76px] items-center rounded-2xl border border-dashed border-border bg-muted/40 p-3">
        {format === "iframe"
          ? <iframe key={`${slug}-${theme}-${lang}`} src={`/embed/app/${slug}?theme=${theme}&lang=${lang}`} width={260} height={72} style={{ border: 0 }} loading="lazy" title={k.preview} />
          // eslint-disable-next-line @next/next/no-img-element -- generated badge, not a static asset
          : <a href={canonical} target="_blank" rel="noopener noreferrer"><img key={`${slug}-${theme}-${lang}`} src={`/api/badge/${slug}?theme=${theme}&lang=${lang}`} width={220} height={60} alt={k.viewOn} /></a>}
      </div>

      <CopyBlock code={snippet} />
      {refCode && <p className="text-xs text-muted-foreground">{fmt(k.refNote, { code: refCode })}</p>}
    </div>
  )
}
