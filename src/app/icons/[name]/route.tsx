import { ImageResponse } from "next/og"
import { IconArt } from "@/lib/icon-art"

const ALLOWED: Record<string, { size: number; maskable: boolean }> = {
  "icon-192.png": { size: 192, maskable: false },
  "icon-512.png": { size: 512, maskable: false },
  "maskable-512.png": { size: 512, maskable: true },
}

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const cfg = ALLOWED[(await params).name]
  if (!cfg) return new Response("Not found", { status: 404 })
  return new ImageResponse(<IconArt {...cfg} />, { width: cfg.size, height: cfg.size, headers: { "cache-control": "public, max-age=31536000, immutable" } })
}
