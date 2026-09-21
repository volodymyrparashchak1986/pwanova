"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, ImagePlus, Loader2, Sparkles, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { AppIcon } from "./app-icon"
import { analyzeApp, submitApp } from "@/actions/apps"
import { BUILD_TOOLS, CATEGORIES, HOSTS, LAUNCH_SOURCES, type BuildTool, type CategorySlug, type HostProvider } from "@/lib/constants"
import { createClient } from "@/lib/supabase/browser"
import { cn } from "@/lib/utils"

type Analysis = Extract<Awaited<ReturnType<typeof analyzeApp>>, { ok: true }>["analysis"]
const sel = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring"

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-sm font-medium">{label}</span>{children}{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</label>
}

export function ShipForm({ userId }: { userId: string }) {
  const router = useRouter()
  const [url, setUrl] = useState("")
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [analyzing, startAnalyze] = useTransition()
  const [submitting, startSubmit] = useTransition()
  const [error, setError] = useState<{ text: string; existing?: string } | null>(null)

  const [name, setName] = useState("")
  const [tagline, setTagline] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<CategorySlug>("other")
  const [build, setBuild] = useState<BuildTool>("other")
  const [host, setHost] = useState<HostProvider>("other")
  const [launch, setLaunch] = useState<(typeof LAUNCH_SOURCES)[number]>("Direct")
  const [launchUrl, setLaunchUrl] = useState("")
  const [iconUrl, setIconUrl] = useState("")
  const [shots, setShots] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  function analyze(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startAnalyze(async () => {
      const r = await analyzeApp(url)
      if (!r.ok) return setError({ text: r.error })
      const a = r.analysis
      setAnalysis(a)
      setName(a.title.split(/\s[|\-–—:]\s/)[0].slice(0, 80))
      setTagline(a.description.slice(0, 120))
      setDescription(a.description)
      setHost(a.host); setIconUrl(a.iconUrl ?? ""); setShots(a.screenshots)
      if (!a.reachable) toast.warning("We couldn't reach that site, but you can still continue.")
    })
  }

  async function upload(files: FileList | null, target: "icon" | "shot") {
    if (!files?.length) return
    setUploading(true)
    const sb = createClient()
    for (const f of Array.from(files).slice(0, 8)) {
      if (!["image/png", "image/jpeg", "image/webp"].includes(f.type) || f.size > 2 * 1024 * 1024) { toast.error(`${f.name}: use PNG/JPEG/WebP under 2 MB`); continue }
      const path = `${userId}/${crypto.randomUUID()}.${f.type.split("/")[1]}`
      const { error } = await sb.storage.from("app-media").upload(path, f, { contentType: f.type })
      if (error) { toast.error("Upload failed"); continue }
      const { data } = sb.storage.from("app-media").getPublicUrl(path)
      if (target === "icon") setIconUrl(data.publicUrl); else setShots((s) => [...s, data.publicUrl].slice(0, 8))
    }
    setUploading(false)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startSubmit(async () => {
      const r = await submitApp({ url, name, tagline, description, category, buildTool: build, hostingProvider: host, launchSource: launch, launchUrl, iconUrl, screenshots: shots })
      if (r.ok && r.data) { toast.success("Your app is listed. Verify ownership to earn PWANova Verified."); router.push(`/apps/${r.data.slug}/claim`) }
      else if (!r.ok) setError({ text: r.error, existing: r.existingSlug })
    })
  }

  return (
    <div className="space-y-8">
      <form onSubmit={analyze} className="space-y-3">
        <Field label="App URL" hint="We fetch your public page server-side to read its title, icon, manifest and headers. Nothing of yours is executed.">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input type="text" inputMode="url" required placeholder="https://your-app.vercel.app" value={url} onChange={(e) => setUrl(e.target.value)} className="h-12 flex-1 rounded-xl px-4 text-base" />
            <Button size="lg" disabled={analyzing || !url}>{analyzing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}Analyze App</Button>
          </div>
        </Field>
      </form>

      {error && (
        <p role="alert" className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
          {error.text} {error.existing && <Link className="font-semibold underline" href={`/apps/${error.existing}/claim`}>Claim it</Link>}
        </p>
      )}

      {analysis && (
        <form onSubmit={submit} className="space-y-6 animate-rise">
          <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-4 text-sm">
            {[
              ["Reachable", analysis.checks.reachable], ["HTTPS", analysis.checks.https_ok], ["Responsive", analysis.checks.responsive],
              ["Manifest", analysis.checks.manifest_ok], ["Installable", analysis.checks.installable], ["Service worker", analysis.checks.service_worker_ok],
            ].map(([l, ok]) => (
              <span key={String(l)} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", ok ? "bg-ok/15 text-ok" : "bg-muted text-muted-foreground")}>
                {ok ? <CheckCircle2 className="size-3.5" /> : <X className="size-3.5" />}{String(l)}
              </span>
            ))}
            {analysis.hostSignal && <span className="text-xs text-muted-foreground">Host detected: {analysis.hostSignal}</span>}
            <p className="w-full text-xs text-muted-foreground">These are detected automatically and re-verified by PWANova after you submit. Detection is heuristic.</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="App name"><Input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" /></Field>
            <Field label="Category"><select className={sel} value={category} onChange={(e) => setCategory(e.target.value as CategorySlug)}>{CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></Field>
            <div className="md:col-span-2"><Field label="Tagline" hint={`${tagline.length}/120`}><Input required maxLength={120} value={tagline} onChange={(e) => setTagline(e.target.value)} className="h-11 rounded-xl" /></Field></div>
            <div className="md:col-span-2"><Field label="Description"><Textarea rows={5} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} /></Field></div>
            <Field label="Built with"><select className={sel} value={build} onChange={(e) => setBuild(e.target.value as BuildTool)}>{BUILD_TOOLS.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}</select></Field>
            <Field label="Hosted on" hint="Auto-detected when possible."><select className={sel} value={host} onChange={(e) => setHost(e.target.value as HostProvider)}>{HOSTS.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}</select></Field>
            <Field label="Launch source" hint="Where did this app launch or get discovered?"><select className={sel} value={launch} onChange={(e) => setLaunch(e.target.value as typeof launch)}>{LAUNCH_SOURCES.map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Launch URL (optional)"><Input type="url" placeholder="https://www.producthunt.com/posts/…" value={launchUrl} onChange={(e) => setLaunchUrl(e.target.value)} className="h-11 rounded-xl" /></Field>
          </div>

          <div className="grid gap-5 md:grid-cols-[auto_1fr]">
            <div className="space-y-2">
              <span className="text-sm font-medium">Icon</span>
              <div className="flex items-center gap-3"><AppIcon app={{ name: name || "A", slug: name || "app", iconUrl: iconUrl || null }} size="lg" />
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted"><ImagePlus className="size-4" />Upload<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => upload(e.target.files, "icon")} /></label></div>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium">Screenshots</span>
              <div className="flex flex-wrap gap-2">
                {shots.map((s, i) => (
                  <span key={s} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- remote preview */}
                    <img src={s} alt="" referrerPolicy="no-referrer" className="h-28 w-16 rounded-lg border border-border object-cover" />
                    <button type="button" aria-label="Remove screenshot" onClick={() => setShots((x) => x.filter((_, k) => k !== i))} className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-foreground text-background"><X className="size-3" /></button>
                  </span>
                ))}
                {shots.length < 8 && <label className="grid h-28 w-16 cursor-pointer place-items-center rounded-lg border border-dashed border-border text-muted-foreground hover:bg-muted">{uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-5" />}<input type="file" multiple accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => upload(e.target.files, "shot")} /></label>}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
            <Button size="lg" className="rounded-full" disabled={submitting || uploading}>{submitting && <Loader2 className="size-4 animate-spin" />}Ship Your App</Button>
            <p className="text-xs text-muted-foreground">Your listing goes live immediately. Ownership starts unverified; verify your domain next to unlock developer replies and PWANova Verified.</p>
          </div>
        </form>
      )}
    </div>
  )
}
