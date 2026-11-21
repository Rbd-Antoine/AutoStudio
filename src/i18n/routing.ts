import { defineRouting } from 'next-intl/routing'
import { createNavigation } from 'next-intl/navigation'

export const routing = defineRouting({
  // French only until another edition is really translated. /en, /de, /es and /pt used to serve
  // the French pages under another lang attribute and no canonical: duplicate content for
  // search engines, and a mismatched page for visitors. They now redirect to the French page
  // (RETIRED_LOCALES in middleware.ts). Adding a translated edition back: its code here, its
  // messages file, and remove it from RETIRED_LOCALES.
  locales: ['fr'],
  defaultLocale: 'fr',
  // 'as-needed' keeps FR at root (`/pricing`) and prefixes others (`/en/pricing`)
  localePrefix: 'as-needed',
  // Site content (Nav, Hero, About, Pricing, etc.) is hardcoded French, not yet
  // driven by translation keys — only Footer uses next-intl's t(). Until the rest
  // of the site is translated, browser-language auto-redirect (e.g. an English
  // browser silently landing on /en) produces a broken mixed-language page.
  // Always serve French at "/" regardless of browser language.
  localeDetection: false,
})

export type Locale = (typeof routing.locales)[number]

// Locale-aware Link, useRouter, etc. — drop-in replacements for next/link & next/navigation
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
