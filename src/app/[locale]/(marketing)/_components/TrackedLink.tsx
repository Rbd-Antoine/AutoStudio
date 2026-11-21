'use client'

import type { CSSProperties, ReactNode } from 'react'
import { Link } from '@/i18n/routing'
import { trackEvent, ANALYTICS_EVENTS } from '@/lib/analytics/client'

// Thin client island so CTA sections that are otherwise pure markup (Hero, Final CTA)
// can stay server components instead of shipping their whole section as client JS.
export function TrackedLink({
  href, ctaId, label, location, className, style, children,
}: {
  href: string
  ctaId: string
  label: string
  location: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={className}
      style={style}
      onClick={() => trackEvent(ANALYTICS_EVENTS.CTA_CLICKED, { ctaId, label, location })}
    >
      {children}
    </Link>
  )
}
