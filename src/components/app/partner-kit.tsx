"use client"

import { useMemo, useState } from "react"
import { Copy } from "lucide-react"
import { toast } from "sonner"
import { siteUrl } from "@/lib/env"

function CopyBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-2xl bg-[oklch(0.17_0.03_275)] p-5 pr-12 text-[13px] leading-relaxed text-white/90"><code>{code}</code></pre>
      <button aria-label="Copy snippet" onClick={() => { navigator.clipboard.writeText(code); toast.success("Copied") }} className="absolute top-4 right-4 rounded-lg bg-white/10 p-1.5 text-white/80 hover:bg-white/20"><Copy className="size-4" /></button>
    </div>
  )
}

/** Live embed-snippet generator for the app page's "Embed badge" link and the /partners docs. */
export function PartnerKit({ apps, refCode }: { apps: { slug: string; name: string }[]; refCode?: string }) {
  const [slug, setSlug] = useState(apps[0]?.slug ?? "")
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [format, setFormat] = useState<"iframe" | "image">("iframe")
  const ref = refCode ? `?ref=${refCode}` : ""
  const canonical = `${siteUrl}/apps/${slug}${ref}`

  const snippet = useMemo(() => {
    if (format === "iframe") {
      return `<iframe src="${siteUrl}/embed/app/${slug}?theme=${theme}"\n        width="260" height="72" style="border:0" loading="lazy"\n        title="${slug} on PWANova"></iframe>`
    }
    return `<a href="${canonical}" target="_blank" rel="noopener">\n  <img src="${siteUrl}/api/badge/${slug}?theme=${theme}"\n       width="220" height="60" alt="View on PWANova" loading="lazy">\n</a>`
  }, [slug, theme, format, canonical])

  const selectCls = "h-9 rounded-lg border border-input bg-background px-2.5 text-sm"
  return (
    <div className="space-y-4 rounded-3xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <select className={selectCls} value={slug} onChange={(e) => setSlug(e.target.value)} aria-label="App">
          {apps.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
        </select>
        <select className={selectCls} value={format} onChange={(e) => setFormat(e.target.value as typeof format)} aria-label="Format">
          <option value="iframe">iframe embed</option>
          <option value="image">Plain image + link (no JS)</option>
        </select>
        <select className={selectCls} value={theme} onChange={(e) => setTheme(e.target.value as typeof theme)} aria-label="Theme">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>

      <div className="flex min-h-[76px] items-center rounded-2xl border border-dashed border-border bg-muted/40 p-3">
        {format === "iframe"
          ? <iframe key={`${slug}-${theme}`} src={`/embed/app/${slug}?theme=${theme}`} width={260} height={72} style={{ border: 0 }} loading="lazy" title="Live preview" />
          // eslint-disable-next-line @next/next/no-img-element -- generated badge, not a Next-optimizable static asset
          : <a href={canonical} target="_blank" rel="noopener noreferrer"><img key={`${slug}-${theme}`} src={`/api/badge/${slug}?theme=${theme}`} width={220} height={60} alt="View on PWANova" /></a>}
      </div>

      <CopyBlock code={snippet} />
      {refCode && <p className="text-xs text-muted-foreground">The canonical link includes <code>?ref={refCode}</code>, so clicks through it are attributed to this integration without changing the app&apos;s launch source.</p>}
    </div>
  )
}
