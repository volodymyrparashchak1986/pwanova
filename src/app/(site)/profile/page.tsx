import type { Metadata } from "next"
import Link from "next/link"
import { LayoutDashboard, LogOut, ShieldAlert } from "lucide-react"
import { PageShell } from "@/components/app/section-header"
import { ProfileForm } from "@/components/app/profile-form"
import { SignedOutCard } from "@/components/app/signed-out"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { Button, buttonVariants } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getViewer } from "@/lib/data"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Profile", robots: { index: false } }

export default async function ProfilePage() {
  const viewer = await getViewer()
  if (!viewer) {
    return (
      <PageShell>
        <SignedOutCard title="Your profile" body="Sign in to manage your profile, reviews and apps." next="/profile" />
        <div className="mx-auto mt-6 flex max-w-md items-center justify-between rounded-2xl border border-border bg-card px-4 py-2 text-sm">Appearance<ThemeToggle /></div>
      </PageShell>
    )
  }
  const sb = await createClient()
  const { data: p } = await sb.from("profiles").select("bio, website").eq("id", viewer.id).maybeSingle()
  return (
    <PageShell className="max-w-xl">
      <h1 className="text-4xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">{viewer.email} · <Link className="hover:underline" href={`/developers/${viewer.username}`}>@{viewer.username}</Link></p>
      <div className="mt-8"><ProfileForm initial={{ displayName: viewer.displayName, bio: p?.bio ?? "", website: p?.website ?? "" }} /></div>
      <div className="mt-8 flex flex-wrap gap-2">
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}><LayoutDashboard className="size-4" />Dashboard</Link>
        {viewer.role === "admin" && <Link href="/admin" className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}><ShieldAlert className="size-4" />Admin</Link>}
        <form action="/auth/sign-out" method="post"><Button variant="ghost" className="rounded-full text-muted-foreground"><LogOut className="size-4" />Sign out</Button></form>
        <span className="ml-auto"><ThemeToggle /></span>
      </div>
    </PageShell>
  )
}
