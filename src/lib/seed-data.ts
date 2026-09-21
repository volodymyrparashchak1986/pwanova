/**
 * DEMO DATA. Single source of truth for:
 *  - demo mode (no Supabase credentials): src/lib/data/demo.ts
 *  - supabase/seed.sql:                    `npm run seed:generate`
 * Everything here is fabricated for development. Demo rows carry is_demo = true
 * and the UI labels them. Demo domains use the reserved `.example` TLD.
 */
import type { BuildTool, CategorySlug, HostProvider } from "./constants"

const pad = (n: number, w = 12) => String(n).padStart(w, "0")
export const uuid = (prefix: number, n: number) => `${prefix}0000000-0000-4000-8000-${pad(n)}`

export interface SeedPartner { id: string; name: string; slug: string; website: string; referralCode: string }
export const SEED_PARTNERS: SeedPartner[] = [
  { id: uuid(3, 1), name: "Product Hunt", slug: "product-hunt", website: "https://www.producthunt.com", referralCode: "demo-ph" },
  { id: uuid(3, 2), name: "Peerlist", slug: "peerlist", website: "https://peerlist.io", referralCode: "demo-peerlist" },
  { id: uuid(3, 3), name: "Vibeking", slug: "vibeking", website: "https://vibeking.example", referralCode: "demo-vibeking" },
  { id: uuid(3, 4), name: "Vibe directory", slug: "vibe-directory", website: "https://vibe-directory.example", referralCode: "demo-vibedir" },
]

export interface SeedDeveloper { id: string; username: string; displayName: string; bio: string; website: string; verified: boolean }
export const SEED_DEVELOPERS: SeedDeveloper[] = [
  { id: uuid(2, 1), username: "novalabs", displayName: "Nova Labs", bio: "Small studio shipping fast, useful web apps. Mostly Next.js, mostly on weekends.", website: "https://novalabs.example", verified: true },
  { id: uuid(2, 2), username: "kite-studio", displayName: "Kite Studio", bio: "Calm software for focus and everyday planning.", website: "https://kite.example", verified: true },
  { id: uuid(2, 3), username: "marina-dev", displayName: "Marina Okafor", bio: "Indie developer. Building tools for freelancers and tiny teams.", website: "https://marina.example", verified: false },
  { id: uuid(2, 4), username: "pixelforge", displayName: "PixelForge", bio: "Creative tools that run anywhere a browser does.", website: "https://pixelforge.example", verified: true },
  { id: uuid(2, 5), username: "oak-and-ember", displayName: "Oak & Ember", bio: "Food, travel and lifestyle apps made with care.", website: "https://oakember.example", verified: false },
  { id: uuid(2, 6), username: "driftworks", displayName: "Driftworks", bio: "Developer tooling and monitoring for solo builders.", website: "https://driftworks.example", verified: true },
]

const FIRST = ["Ava","Liam","Noah","Mia","Ethan","Zoe","Lucas","Ivy","Leo","Nora","Owen","Ruby","Kai","Elena","Max","Sofia","Theo","Lena","Finn","Maya","Jude","Clara","Ravi","Anya"]
const LAST = ["M","K","R","T"]
export interface SeedUser { id: string; username: string; displayName: string }
export const SEED_USERS: SeedUser[] = Array.from({ length: 64 }, (_, i) => {
  const first = FIRST[i % FIRST.length]
  const last = LAST[Math.floor(i / FIRST.length)] ?? "Z"
  return { id: uuid(1, i + 1), username: `demo-${first.toLowerCase()}-${last.toLowerCase()}`, displayName: `${first} ${last}.` }
})

export interface SeedReview { user: number; rating: number; title?: string; body: string; daysAgo: number; helpful: number; response?: string }
export interface SeedApp {
  slug: string; name: string; tagline: string; description: string
  category: CategorySlug; build: BuildTool; host: HostProvider
  developer: string
  launch?: { name: string; type: "launched_on" | "discovered_via"; partner?: string; url?: string }
  ratings: { n: number; target: number }
  pwa: boolean; installable: boolean; serviceWorker: boolean; offline: boolean; push: boolean
  verified: boolean; featured?: boolean
  opens30d: number; daysOld: number
  reviews: SeedReview[]
}

export const SEED_APPS: SeedApp[] = [
  { slug: "metro-fit", name: "Metro Fit", tagline: "Team fitness tracking and challenges.", category: "fitness", build: "claude-code", host: "vercel", developer: "novalabs",
    description: "Metro Fit turns workouts into a team sport. Log sessions in seconds, join weekly challenges with coworkers or friends, and watch the leaderboard move. Works offline in the gym and syncs when you're back online.",
    launch: { name: "Product Hunt", type: "launched_on", partner: "product-hunt" }, ratings: { n: 52, target: 4.9 }, pwa: true, installable: true, serviceWorker: true, offline: true, push: true, verified: true, featured: true, opens30d: 1240, daysOld: 210,
    reviews: [
      { user: 0, rating: 5, title: "Finally, our office actually works out", body: "We run a monthly step challenge and it's been the easiest thing to set up. Installing it on my phone took ten seconds and it loads instantly.", daysAgo: 5, helpful: 9, response: "Thank you! Monthly challenges are the best use case. Group chat reminders land in v1.6." },
      { user: 1, rating: 5, body: "Logging a workout is genuinely fast. Offline mode saved me at a basement gym with no signal.", daysAgo: 12, helpful: 4 },
      { user: 2, rating: 4, title: "Great, wants more chart options", body: "Love the leaderboards. I'd like weekly trend charts per person, but the core loop is excellent.", daysAgo: 30, helpful: 2 },
    ] },
  { slug: "focusflow", name: "FocusFlow", tagline: "Deep-work timer with gentle nudges.", category: "productivity", build: "v0", host: "vercel", developer: "kite-studio",
    description: "FocusFlow pairs a distraction-free timer with a daily intention. Plan up to three focus blocks, get a soft chime when it's time to break, and review a weekly summary that never guilt-trips you.",
    launch: { name: "Product Hunt", type: "launched_on", partner: "product-hunt" }, ratings: { n: 44, target: 4.7 }, pwa: true, installable: true, serviceWorker: true, offline: true, push: false, verified: true, featured: true, opens30d: 980, daysOld: 150,
    reviews: [
      { user: 3, rating: 5, title: "The only timer I kept using", body: "Clean, quiet and it doesn't nag. The weekly summary is a nice touch.", daysAgo: 3, helpful: 6 },
      { user: 4, rating: 4, body: "Solid. Would love a dark-mode schedule, but installing it as an app on my laptop is smooth.", daysAgo: 20, helpful: 1, response: "Scheduled dark mode is on the way. Thanks for the note!" },
    ] },
  { slug: "invoicelite", name: "InvoiceLite", tagline: "Send clean invoices in under a minute.", category: "finance", build: "cursor", host: "netlify", developer: "marina-dev",
    description: "InvoiceLite is for freelancers who dislike accounting software. Pick a client, add line items, and share a payment-ready invoice link. Track what's paid, pending, and overdue at a glance.",
    launch: { name: "Peerlist", type: "launched_on", partner: "peerlist" }, ratings: { n: 31, target: 4.5 }, pwa: true, installable: true, serviceWorker: true, offline: false, push: false, verified: true, opens30d: 610, daysOld: 320,
    reviews: [
      { user: 5, rating: 5, body: "Sent my first invoice in about 40 seconds. Exactly what I needed.", daysAgo: 8, helpful: 3 },
      { user: 6, rating: 4, title: "Simple and fast", body: "Would like recurring invoices. Everything else is great.", daysAgo: 41, helpful: 2 },
    ] },
  { slug: "mealcraft", name: "MealCraft", tagline: "Weekly meal plans that fit your pantry.", category: "food", build: "lovable", host: "custom-domain", developer: "oak-and-ember",
    description: "Tell MealCraft what's in your kitchen and how many people you're feeding. It drafts a week of meals, builds a shopping list, and swaps recipes you don't like with one tap.",
    launch: { name: "Vibeking", type: "discovered_via", partner: "vibeking" }, ratings: { n: 26, target: 4.6 }, pwa: true, installable: true, serviceWorker: true, offline: true, push: false, verified: false, opens30d: 430, daysOld: 95,
    reviews: [
      { user: 7, rating: 5, body: "The pantry-first approach cut our grocery bill noticeably.", daysAgo: 6, helpful: 5 },
      { user: 8, rating: 4, body: "Nice recipes. Shopping list grouping by aisle would be perfect.", daysAgo: 25, helpful: 1 },
    ] },
  { slug: "tripboard", name: "TripBoard", tagline: "Plan trips together on one shared board.", category: "travel", build: "bolt", host: "vercel", developer: "oak-and-ember",
    description: "Collect flights, stays and ideas on a shared board. Everyone in the group can vote, comment and drag things into a day-by-day itinerary that works offline while you travel.",
    launch: { name: "Show HN", type: "launched_on", url: "https://news.ycombinator.com" }, ratings: { n: 22, target: 4.3 }, pwa: true, installable: true, serviceWorker: true, offline: true, push: false, verified: false, opens30d: 350, daysOld: 60,
    reviews: [
      { user: 9, rating: 5, title: "Group trips without the chaos", body: "Voting on hotels inside the app ended a very long group chat.", daysAgo: 10, helpful: 7 },
      { user: 10, rating: 3, body: "Good idea, but map view is slow with many pins.", daysAgo: 33, helpful: 3, response: "Thanks. Clustering pins ships in the next release." },
    ] },
  { slug: "teampulse", name: "TeamPulse", tagline: "Two-minute weekly check-ins for small teams.", category: "business", build: "codex", host: "render", developer: "novalabs",
    description: "TeamPulse replaces status meetings with a two-minute weekly check-in. See morale trends, spot blockers early, and give kudos, all without another dashboard to babysit.",
    launch: { name: "Product Hunt", type: "launched_on", partner: "product-hunt" }, ratings: { n: 38, target: 4.4 }, pwa: true, installable: false, serviceWorker: false, offline: false, push: false, verified: true, opens30d: 720, daysOld: 260,
    reviews: [
      { user: 11, rating: 4, body: "Our Monday meeting is now ten minutes shorter. That's the review.", daysAgo: 14, helpful: 5 },
      { user: 12, rating: 5, body: "Simple enough that everyone actually fills it in.", daysAgo: 28, helpful: 2 },
    ] },
  { slug: "habitloop", name: "HabitLoop", tagline: "Build habits with tiny daily wins.", category: "health", build: "replit", host: "cloudflare", developer: "kite-studio",
    description: "HabitLoop keeps habits small on purpose. Track up to five, see streaks that forgive a missed day, and get an occasional reminder that feels like a friend rather than an alarm.",
    launch: { name: "Reddit", type: "discovered_via", url: "https://reddit.com" }, ratings: { n: 47, target: 4.6 }, pwa: true, installable: true, serviceWorker: true, offline: true, push: true, verified: true, opens30d: 890, daysOld: 400,
    reviews: [
      { user: 13, rating: 5, title: "Forgiving streaks are a great idea", body: "Missed a day for the first time in months and didn't feel terrible. Weirdly motivating.", daysAgo: 2, helpful: 8 },
      { user: 14, rating: 4, body: "Push reminders are well-timed. Wish it had widgets.", daysAgo: 19, helpful: 2 },
    ] },
  { slug: "studyspace", name: "StudySpace", tagline: "Flashcards and study rooms that keep you honest.", category: "education", build: "claude-code", host: "firebase", developer: "marina-dev",
    description: "StudySpace combines spaced-repetition flashcards with quiet study rooms. Join a room, set a goal, and study alongside others without chat noise. Import decks from CSV in seconds.",
    launch: { name: "Peerlist", type: "launched_on", partner: "peerlist" }, ratings: { n: 29, target: 4.5 }, pwa: true, installable: true, serviceWorker: true, offline: true, push: false, verified: true, opens30d: 520, daysOld: 180,
    reviews: [
      { user: 15, rating: 5, body: "Study rooms sound gimmicky but they genuinely help me sit down and start.", daysAgo: 9, helpful: 6 },
      { user: 16, rating: 4, body: "Spaced repetition works well. CSV import saved me an evening.", daysAgo: 37, helpful: 1 },
    ] },
  { slug: "budgetly", name: "Budgetly", tagline: "A budget you can read at a glance.", category: "finance", build: "v0", host: "vercel", developer: "novalabs",
    description: "Budgetly gives you one screen: what's left this month, what's coming up, and what to skip. No bank connections required. Add expenses in two taps and let categories learn from you.",
    launch: { name: "Vibe directory", type: "discovered_via", partner: "vibe-directory" }, ratings: { n: 36, target: 4.4 }, pwa: true, installable: true, serviceWorker: true, offline: true, push: false, verified: true, opens30d: 660, daysOld: 130,
    reviews: [
      { user: 17, rating: 5, body: "The 'what's left' number is all I ever wanted from a budgeting app.", daysAgo: 4, helpful: 4 },
      { user: 18, rating: 3, title: "Needs multi-currency", body: "Works great for one currency; I travel a lot and need more.", daysAgo: 22, helpful: 3, response: "Multi-currency is our top request and is in progress." },
    ] },
  { slug: "devmonitor", name: "DevMonitor", tagline: "Uptime and deploy alerts for solo builders.", category: "developer-tools", build: "cursor", host: "railway", developer: "driftworks",
    description: "DevMonitor watches your side projects so you don't have to. Get a calm alert when a deploy breaks or a site goes down, with a one-page status summary you can share.",
    launch: { name: "Show HN", type: "launched_on", url: "https://news.ycombinator.com" }, ratings: { n: 41, target: 4.7 }, pwa: true, installable: true, serviceWorker: true, offline: false, push: true, verified: true, featured: true, opens30d: 770, daysOld: 240,
    reviews: [
      { user: 19, rating: 5, title: "Perfect for side projects", body: "Alerts arrive as push notifications on my phone. Set up took five minutes.", daysAgo: 7, helpful: 9 },
      { user: 20, rating: 4, body: "Would love Slack integration, otherwise great value.", daysAgo: 26, helpful: 2 },
    ] },
  { slug: "photodrop", name: "PhotoDrop", tagline: "Share event photos with one QR code.", category: "social", build: "bolt", host: "cloudflare", developer: "pixelforge",
    description: "Create an album, show a QR code, and guests upload photos straight from their browser, no account needed. Download everything as a zip after the party.",
    launch: { name: "Product Hunt", type: "launched_on", partner: "product-hunt" }, ratings: { n: 33, target: 4.2 }, pwa: true, installable: true, serviceWorker: true, offline: false, push: false, verified: false, opens30d: 540, daysOld: 75,
    reviews: [
      { user: 21, rating: 5, body: "Used it at my sister's wedding. Guests loved not having to install anything.", daysAgo: 11, helpful: 10 },
      { user: 22, rating: 3, body: "Uploads sometimes stall on slow networks.", daysAgo: 24, helpful: 4, response: "Chunked uploads with retry landed in 1.2. Please try again!" },
    ] },
  { slug: "ai-notes", name: "AI Notes", tagline: "Notes that summarize themselves.", category: "ai", build: "claude-code", host: "vercel", developer: "pixelforge",
    description: "Write freely and let AI Notes draft titles, summaries and action items. Everything stays searchable, and you can ask questions across all of your notes.",
    launch: { name: "Product Hunt", type: "launched_on", partner: "product-hunt" }, ratings: { n: 57, target: 4.5 }, pwa: true, installable: true, serviceWorker: true, offline: true, push: false, verified: true, featured: true, opens30d: 1410, daysOld: 110,
    reviews: [
      { user: 23, rating: 5, title: "Asking my notes questions is addictive", body: "Found a decision from three months ago in seconds. Summaries are accurate and short.", daysAgo: 1, helpful: 11 },
      { user: 24, rating: 4, body: "Great. I wish there were a way to export summaries as Markdown.", daysAgo: 15, helpful: 3 },
    ] },
  { slug: "localchef", name: "LocalChef", tagline: "Find home cooks and pop-up dinners nearby.", category: "food", build: "lovable", host: "netlify", developer: "oak-and-ember",
    description: "LocalChef connects neighbors with home cooks hosting small dinners and pop-ups. Browse menus, reserve a seat, and meet the people behind the food.",
    launch: { name: "Vibeking", type: "discovered_via", partner: "vibeking" }, ratings: { n: 14, target: 4.0 }, pwa: true, installable: false, serviceWorker: false, offline: false, push: false, verified: false, opens30d: 190, daysOld: 28,
    reviews: [
      { user: 25, rating: 4, body: "Booked a dumpling night two blocks away. Lovely idea, still growing in my city.", daysAgo: 6, helpful: 2 },
      { user: 26, rating: 4, body: "Browsing is smooth. More listings would make it a daily app.", daysAgo: 13, helpful: 1 },
    ] },
  { slug: "taskpilot", name: "TaskPilot", tagline: "A todo list that plans your day for you.", category: "productivity", build: "windsurf", host: "vercel", developer: "driftworks",
    description: "TaskPilot looks at your tasks, estimates, and calendar to suggest a realistic plan for today. Accept it, tweak it, or ignore it. It learns either way.",
    launch: { name: "Direct", type: "launched_on" }, ratings: { n: 1, target: 5 }, pwa: true, installable: true, serviceWorker: true, offline: false, push: false, verified: false, opens30d: 60, daysOld: 6,
    reviews: [
      { user: 27, rating: 5, body: "Early, but the daily plan is already surprisingly sensible.", daysAgo: 2, helpful: 0 },
    ] },
  { slug: "fitcircle", name: "FitCircle", tagline: "Small workout circles with real accountability.", category: "fitness", build: "manual", host: "firebase", developer: "kite-studio",
    description: "FitCircle is for friend groups of 3 to 8. Post your workout, react to others', and keep each other on track with gentle weekly goals. No public feeds, no noise.",
    launch: { name: "Peerlist", type: "discovered_via", partner: "peerlist" }, ratings: { n: 19, target: 4.3 }, pwa: true, installable: true, serviceWorker: true, offline: true, push: true, verified: true, opens30d: 300, daysOld: 45,
    reviews: [
      { user: 28, rating: 5, title: "Exactly the right size", body: "Five of us, one circle, zero pressure. We've all been working out more.", daysAgo: 5, helpful: 4 },
      { user: 29, rating: 4, body: "Love it. Please add rest-day check-ins.", daysAgo: 18, helpful: 1, response: "Rest-day check-ins are next on the list." },
    ] },
]

/** Deterministic PRNG so demo mode and seed.sql agree. */
export function lcg(seed: number) {
  let s = (seed * 2654435761) >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

export interface SeedRating { user: number; rating: number; daysAgo: number }
export function generateRatings(app: SeedApp, appIndex: number): SeedRating[] {
  const rnd = lcg(appIndex + 7)
  const reviewByUser = new Map(app.reviews.map((r) => [r.user, r]))
  const out: SeedRating[] = []
  const used = new Set<number>()
  // reviewers always have a rating that matches their review
  for (const r of app.reviews) { out.push({ user: r.user, rating: r.rating, daysAgo: r.daysAgo }); used.add(r.user) }
  let cursor = (appIndex * 11) % SEED_USERS.length
  while (out.length < app.ratings.n) {
    const u = cursor % SEED_USERS.length
    cursor++
    if (used.has(u) || reviewByUser.has(u)) continue
    used.add(u)
    const rating = Math.min(5, Math.max(1, Math.round(app.ratings.target + (rnd() - 0.42) * 2.4)))
    out.push({ user: u, rating, daysAgo: Math.floor(rnd() * Math.min(app.daysOld, 120)) })
  }
  return out.slice(0, Math.max(app.ratings.n, app.reviews.length))
}

/** Users (by index) who saved an app. Deterministic. */
export function generateFavorites(app: SeedApp, appIndex: number): { user: number; daysAgo: number }[] {
  const rnd = lcg(appIndex + 101)
  const n = Math.min(SEED_USERS.length - 1, Math.floor(app.opens30d / 22))
  const start = (appIndex * 5) % SEED_USERS.length
  return Array.from({ length: n }, (_, k) => ({ user: (start + k) % SEED_USERS.length, daysAgo: Math.floor(rnd() * 60) }))
}

export const SEED_CHECK_DEFAULTS = { reachable: true, https_ok: true, responsive: true, mobile_optimized: true, security_ok: true }
