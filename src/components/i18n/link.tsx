"use client"

import NextLink from "next/link"
import type { ComponentProps } from "react"
import { useLocale } from "@/i18n/client"
import { localizeHref, type Locale } from "@/i18n/config"

type Props = Omit<ComponentProps<typeof NextLink>, "href"> & { href: string; locale?: Locale }

/** next/link that keeps the visitor in their language. Pass `locale` to link to another language. */
export function Link({ href, locale, ...props }: Props) {
  const current = useLocale()
  return <NextLink href={localizeHref(href, locale ?? current)} {...props} />
}
