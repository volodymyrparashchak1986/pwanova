import { createElement } from "react"
import {
  BarChart3, BookOpen, Bot, Briefcase, Code, Contact, GraduationCap, Grid2x2, Handshake, HeartPulse, IdCard, Kanban, LifeBuoy, Megaphone,
  MessageCircle, Music, Palette, Shield, Sun, Users, Wallet, Workflow, Wrench, Zap, type LucideIcon,
} from "lucide-react"

const ICONS: Record<string, LucideIcon> = {
  bot: Bot, zap: Zap, code: Code, handshake: Handshake, megaphone: Megaphone, "life-buoy": LifeBuoy, palette: Palette, users: Users,
  workflow: Workflow, "bar-chart-3": BarChart3, wallet: Wallet, "id-card": IdCard, shield: Shield, "graduation-cap": GraduationCap,
  "message-circle": MessageCircle, kanban: Kanban, contact: Contact, "book-open": BookOpen, briefcase: Briefcase, "heart-pulse": HeartPulse,
  music: Music, sun: Sun, wrench: Wrench, "grid-2x2": Grid2x2,
}

// Object.hasOwn: the name comes from the database, and "constructor" is not an icon
const iconFor = (name: string | null): LucideIcon => (name && Object.hasOwn(ICONS, name) ? ICONS[name] : Grid2x2)

/** The icon name comes from the categories table; an unknown name falls back to a neutral grid. */
export function CategoryIcon({ name, className }: { name: string | null; className?: string }) {
  return createElement(iconFor(name), { className, "aria-hidden": true })
}
