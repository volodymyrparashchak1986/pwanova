import type { MetadataRoute } from "next"

/**
 * One manifest for both language editions. The start address has no language: the proxy sends the
 * person to the language they picked earlier or to the one their browser asks for.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PWANova",
    short_name: "PWANova",
    description: "Discover, verify and compare modern web, AI and PWA applications using documented evidence.",
    id: "/",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8f8fc",
    theme_color: "#f8f8fc",
    categories: ["business", "productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Discover", url: "/discover", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Compare", url: "/compare", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Saved", url: "/saved", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  }
}
