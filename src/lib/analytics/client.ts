'use client'

// Client-side analytics (marketing pages, editor UI). Browser-only — never import this
// from a server component or API route (use '@/lib/analytics/server' there instead).
//
// posthog-js is loaded via a dynamic import gated behind the production check and the
// visitor's analytics consent (below), not a static top-level import, so its ~70kB bundle is
// never fetched outside production or without consent, and doesn't inflate the shared JS
// bundle for everyone.
import type { PostHog } from 'posthog-js'
import { ANALYTICS_EVENTS, type AnalyticsEventName, type ClientTrackPayload } from './events'
import { CONSENT_COOKIE_NAME, parseConsentCookie } from '@/lib/consent'

export const analyticsEnabled =
  process.env.NODE_ENV === 'production' && !!process.env.NEXT_PUBLIC_POSTHOG_KEY

let posthogPromise: Promise<PostHog> | null = null

// PostHog sets cookies and records sessions, so it only runs once the visitor accepted the
// "Mesure d'audience" category of the cookie banner. Read from the consent cookie at startup
// (so a returning visitor's choice applies before hydration), then kept in sync by the
// ConsentProvider through setAnalyticsConsent().
let analyticsConsent = readStoredAnalyticsConsent()

function readStoredAnalyticsConsent(): boolean {
  if (typeof document === 'undefined') return false
  const row = document.cookie.split('; ').find(r => r.startsWith(`${CONSENT_COOKIE_NAME}=`))
  const stored = parseConsentCookie(row ? decodeURIComponent(row.slice(CONSENT_COOKIE_NAME.length + 1)) : null)
  return stored?.categories.analytics === true
}

export function setAnalyticsConsent(granted: boolean): void {
  analyticsConsent = granted
  if (granted) {
    loadPosthog()?.then(ph => { if (ph.has_opted_out_capturing()) ph.opt_in_capturing() })
  } else {
    // Withdrawn after PostHog already loaded: stop capturing and drop its identifiers.
    posthogPromise?.then(ph => { ph.opt_out_capturing(); ph.reset() })
  }
}

function loadPosthog(): Promise<PostHog> | null {
  if (!analyticsEnabled || !analyticsConsent) return null
  if (!posthogPromise) {
    posthogPromise = import('posthog-js').then(({ default: posthog }) => {
      if (!posthog.__loaded) {
        posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
          person_profiles: 'identified_only',
          capture_pageview: false, // manual pageview tracking, see PostHogPageview component
          capture_pageleave: true,
          autocapture: true,
          session_recording: {
            maskAllInputs: true, // never record raw keystrokes (passwords, card fields, etc.)
          },
        })
      }
      return posthog
    })
  }
  return posthogPromise
}

// Called once from instrumentation-client.ts to kick off the (production-only, dynamically
// imported) load as early as possible — every other function in this file awaits the same
// cached promise, so init only ever runs once regardless of load order.
export function ensurePosthogLoaded(): void {
  loadPosthog()
}

export function trackEvent<E extends AnalyticsEventName>(
  event: E,
  properties: ClientTrackPayload<E>,
): void {
  loadPosthog()?.then(ph => ph.capture(event, properties))
}

export function capturePageview(url: string): void {
  loadPosthog()?.then(ph => ph.capture('$pageview', { $current_url: url }))
}

export function captureClientException(error: unknown): void {
  loadPosthog()?.then(ph => ph.captureException(error))
}

// Call once per session after login/signup (and whenever plan/credits change) so the
// PostHog person profile and feature-flag targeting stay in sync with the real user.
export function identifyUser(
  userId: string,
  props: { email?: string | null; plan?: string; workspaceId?: string },
): void {
  loadPosthog()?.then(ph => ph.identify(userId, props))
}

export function resetAnalyticsIdentity(): void {
  loadPosthog()?.then(ph => ph.reset())
}

export { ANALYTICS_EVENTS }
