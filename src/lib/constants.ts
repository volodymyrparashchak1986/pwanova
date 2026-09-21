export const SITE = {
  name: "PWANova",
  tagline: "The distribution layer for the open web.",
  secondary: "Discover. Trust. Install.",
  developerTagline: "Build anywhere. Launch anywhere. Live on PWANova.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const

export const CATEGORIES = [
  { slug: "ai", name: "AI", blurb: "Assistants, generators and agents." },
  { slug: "productivity", name: "Productivity", blurb: "Get more done, with less friction." },
  { slug: "business", name: "Business", blurb: "Run and grow your company." },
  { slug: "finance", name: "Finance", blurb: "Money, budgets and invoicing." },
  { slug: "fitness", name: "Fitness", blurb: "Train, track and compete." },
  { slug: "health", name: "Health", blurb: "Wellbeing you can keep up with." },
  { slug: "education", name: "Education", blurb: "Learn anything, anywhere." },
  { slug: "developer-tools", name: "Developer Tools", blurb: "Tools built by builders." },
  { slug: "social", name: "Social", blurb: "Connect and share." },
  { slug: "entertainment", name: "Entertainment", blurb: "Watch, listen, play." },
  { slug: "utilities", name: "Utilities", blurb: "Small tools that just work." },
  { slug: "lifestyle", name: "Lifestyle", blurb: "Everyday life, made better." },
  { slug: "travel", name: "Travel", blurb: "Plan trips and explore." },
  { slug: "food", name: "Food", blurb: "Cook, plan and discover meals." },
  { slug: "games", name: "Games", blurb: "Play instantly in the browser." },
  { slug: "other", name: "Other", blurb: "Everything else." },
] as const
export type CategorySlug = (typeof CATEGORIES)[number]["slug"]

export const BUILD_TOOLS = [
  { slug: "v0", name: "v0" },
  { slug: "claude-code", name: "Claude Code" },
  { slug: "codex", name: "Codex" },
  { slug: "cursor", name: "Cursor" },
  { slug: "lovable", name: "Lovable" },
  { slug: "bolt", name: "Bolt" },
  { slug: "replit", name: "Replit" },
  { slug: "windsurf", name: "Windsurf" },
  { slug: "manual", name: "Manual" },
  { slug: "other", name: "Other" },
] as const
export type BuildTool = (typeof BUILD_TOOLS)[number]["slug"]

export const HOSTS = [
  { slug: "vercel", name: "Vercel" },
  { slug: "cloudflare", name: "Cloudflare" },
  { slug: "netlify", name: "Netlify" },
  { slug: "firebase", name: "Firebase" },
  { slug: "railway", name: "Railway" },
  { slug: "render", name: "Render" },
  { slug: "custom-domain", name: "Custom Domain" },
  { slug: "other", name: "Other" },
] as const
export type HostProvider = (typeof HOSTS)[number]["slug"]

export const LAUNCH_SOURCES = [
  "Product Hunt",
  "Peerlist",
  "Vibeking",
  "Vibe directory",
  "Show HN",
  "Reddit",
  "Direct",
  "PWANova",
  "Other",
] as const

export const TRAFFIC_SOURCES = [
  "pwanova_search",
  "homepage",
  "product_hunt",
  "partner",
  "google",
  "direct",
  "social",
  "other",
] as const
export type TrafficSource = (typeof TRAFFIC_SOURCES)[number]
export const TRAFFIC_SOURCE_LABELS: Record<string, string> = {
  pwanova_search: "PWANova Search",
  homepage: "Homepage",
  product_hunt: "Product Hunt",
  partner: "Partner",
  google: "Google",
  direct: "Direct",
  social: "Social",
  other: "Other",
}

export const EVENT_TYPES = [
  "view",
  "open_app",
  "install_click",
  "install_instruction_view",
  "favorite",
  "share",
  "review",
  "rating",
] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const REPORT_REASONS = ["spam", "malicious", "impersonation", "inappropriate", "broken", "other"] as const

export const labelFor = {
  category: (slug: string) => CATEGORIES.find((c) => c.slug === slug)?.name ?? "Other",
  build: (slug: string) => BUILD_TOOLS.find((c) => c.slug === slug)?.name ?? "Other",
  host: (slug: string) => HOSTS.find((c) => c.slug === slug)?.name ?? "Other",
}

export const PARTNER_COOKIE = "pwn_ref"
