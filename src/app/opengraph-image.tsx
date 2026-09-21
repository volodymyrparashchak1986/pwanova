import { ImageResponse } from "next/og"
import { IconArt } from "@/lib/icon-art"

export const alt = "PWANova — The distribution layer for the open web"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OG() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#12121a", color: "white" }}>
        <IconArt size={96} />
        <div style={{ fontSize: 76, fontWeight: 700, marginTop: 40, letterSpacing: -2, lineHeight: 1.05 }}>The distribution layer for the open web.</div>
        <div style={{ fontSize: 34, marginTop: 24, color: "#9ea0b8" }}>Discover. Trust. Install.</div>
      </div>
    ),
    size,
  )
}
