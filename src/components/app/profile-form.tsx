"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { updateProfile } from "@/actions/apps"

export function ProfileForm({ initial }: { initial: { displayName: string; bio: string; website: string } }) {
  const [v, setV] = useState(initial)
  const [pending, start] = useTransition()
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await updateProfile(v); if (r.ok) toast.success(r.message); else toast.error(r.error) }) }}>
      <label className="block space-y-1.5 text-sm font-medium">Display name<Input required maxLength={80} value={v.displayName} onChange={(e) => setV({ ...v, displayName: e.target.value })} className="h-11 rounded-xl" /></label>
      <label className="block space-y-1.5 text-sm font-medium">Bio<Textarea maxLength={500} rows={3} value={v.bio} onChange={(e) => setV({ ...v, bio: e.target.value })} /></label>
      <label className="block space-y-1.5 text-sm font-medium">Website<Input type="url" placeholder="https://" value={v.website} onChange={(e) => setV({ ...v, website: e.target.value })} className="h-11 rounded-xl" /></label>
      <Button type="submit" disabled={pending}>Save profile</Button>
    </form>
  )
}
