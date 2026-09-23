import type { BuildTool, CategorySlug, HostProvider } from "../src/lib/constants"

/**
 * Editorial catalog candidates: REAL, publicly reachable web apps listed by URL.
 *
 * Nothing here is fabricated: names/taglines describe what the app itself says it is, every entry is
 * re-analysed live by scripts/import-apps.ts before insertion (unreachable apps and apps not served by
 * the expected host are skipped), ratings/installs start at zero and ownership stays "unclaimed" until
 * the real developer claims the listing through the normal verification flow.
 *
 * Entries with `ownerUsername` belong to a PWANova member (the platform owner's own products); they are
 * attributed to that account and get a claim token, but still have to pass the real well-known-file
 * verification to show as verified.
 *
 * 2026-09-23 probe: 80 well-known web apps were checked live; the ones kept below answered HTTP 200 and
 * were confirmed to be served by Vercel (`x-vercel-id` / `server: Vercel` headers or a *.vercel.app
 * host). Apps found on Cloudflare, Netlify or elsewhere (Squoosh, JSON Crack, Linear, Monkeytype,
 * Phanpy, Bluesky, …) were left out on purpose: this seed is "real projects on Vercel".
 */
export interface Candidate {
  url: string
  name: string
  category: CategorySlug
  /** ≤120 chars, factual, no marketing superlatives */
  tagline: string
  /** Editorial pick shown first on the home page and in the default catalog order */
  featured?: boolean
  /** PWANova username of the developer, when the listing is theirs */
  ownerUsername?: string
  buildTool?: BuildTool
  /** Skip the candidate unless the live analysis confirms this host (default: "vercel") */
  onlyIfHost?: HostProvider | "any"
  /** Force a slug instead of slugify(name) */
  slug?: string
}

export const OWNER = "volodymyrparashchak1986"

export const CANDIDATES: Candidate[] = [
  // ------------------------------------------------------------------ the owner's own products (featured, listed first)
  { url: "https://metro-fit-team.vercel.app", name: "METRO Fit Team", slug: "metro-fit", category: "fitness", tagline: "Training plans, progress tracking and team leaderboards for your fitness team.", featured: true, ownerUsername: OWNER },
  { url: "https://balans-puce.vercel.app", name: "Balance", slug: "balance", category: "health", tagline: "Personal nutrition diary with recipes matched to the calories and macros you have left today.", featured: true, ownerUsername: OWNER },

  // ------------------------------------------------------------------ whiteboards, design, images
  { url: "https://excalidraw.com", name: "Excalidraw", category: "productivity", tagline: "Open-source virtual whiteboard for hand-drawn style diagrams, with live collaboration." },
  { url: "https://www.tldraw.com", name: "tldraw", category: "productivity", tagline: "Free, instant collaborative whiteboard built on the tldraw SDK." },
  { url: "https://carbon.now.sh", name: "Carbon", category: "developer-tools", tagline: "Create and share beautiful images of your source code." },
  { url: "https://ray.so", name: "Ray.so", category: "developer-tools", tagline: "Turn code snippets into shareable images, made by Raycast." },
  { url: "https://pika.style", name: "Pika", category: "utilities", tagline: "Design screenshot mockups, backgrounds and social images in the browser." },
  { url: "https://screenshot.rocks", name: "Screenshot Rocks", category: "utilities", tagline: "Turn plain screenshots into browser and device mockups." },
  { url: "https://realtimecolors.com", name: "Realtime Colors", category: "developer-tools", tagline: "Preview colors and fonts on a real page layout before you commit to them." },
  { url: "https://www.spline.design", name: "Spline", category: "productivity", tagline: "Design and animate 3D scenes for the web in the browser, with real-time collaboration." },

  // ------------------------------------------------------------------ developer tools
  { url: "https://transform.tools", name: "Transform", category: "developer-tools", tagline: "Convert between JSON, TypeScript, GraphQL, CSS-in-JS and dozens of other formats." },
  { url: "https://play.tailwindcss.com", name: "Tailwind Play", category: "developer-tools", tagline: "Official in-browser playground for Tailwind CSS." },
  { url: "https://typehero.dev", name: "TypeHero", category: "education", tagline: "Interactive TypeScript type challenges to sharpen your skills." },
  { url: "https://www.openstatus.dev", name: "OpenStatus", category: "developer-tools", tagline: "Open-source status pages and uptime monitoring, self-hostable." },
  { url: "https://hoppscotch.io", name: "Hoppscotch", category: "developer-tools", tagline: "Open-source API development ecosystem: REST, GraphQL and WebSocket client in the browser." },
  { url: "https://umami.is", name: "Umami", category: "business", tagline: "Privacy-first, open-source website analytics without cookies." },
  { url: "https://trigger.dev", name: "Trigger.dev", category: "developer-tools", tagline: "Open-source platform for durable AI agents and background jobs in TypeScript." },

  // ------------------------------------------------------------------ productivity & business
  { url: "https://dub.co", name: "Dub", category: "business", tagline: "Link attribution platform: short links, conversion tracking and affiliate programs." },
  { url: "https://www.papermark.com", name: "Papermark", category: "business", tagline: "Secure data rooms and document sharing with page-level analytics." },
  { url: "https://plane.so", name: "Plane", category: "productivity", tagline: "Project management for teams and AI agents: projects, wiki and cycles." },
  { url: "https://midday.ai", name: "Midday", category: "finance", tagline: "Invoicing, time tracking, reconciliation and financial exports for founders and freelancers." },

  // ------------------------------------------------------------------ AI, music, focus
  { url: "https://openrouter.ai", name: "OpenRouter", category: "ai", tagline: "One interface and API for every major AI model, with prices and rankings." },
  { url: "https://www.chatpdf.com", name: "ChatPDF", category: "ai", tagline: "Ask questions about any PDF and get answers from its content." },
  { url: "https://t3.chat", name: "T3 Chat", category: "ai", tagline: "Fast multi-model AI chat client." },
  { url: "https://suno.com", name: "Suno", category: "entertainment", tagline: "Make original songs from a text prompt." },
  { url: "https://www.udio.com", name: "Udio", category: "entertainment", tagline: "Create, discover and share AI-generated music." },
  { url: "https://www.lofi.cafe", name: "lofi.cafe", category: "entertainment", tagline: "Lo-fi music streams for studying, working and relaxing." },
]
