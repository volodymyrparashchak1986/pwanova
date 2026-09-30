"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n/client"

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const { t } = useI18n()
  return (
    <Button variant="ghost" size="icon" className={className} aria-label={t.common.theme} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
      <Sun className="size-[18px] dark:hidden" />
      <Moon className="hidden size-[18px] dark:block" />
    </Button>
  )
}
