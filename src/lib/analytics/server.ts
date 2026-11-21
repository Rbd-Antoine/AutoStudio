// Server-side analytics (API routes, Stripe webhooks, NextAuth callbacks). Node-only —
// never import this from a client component. Disabled outside production so dev/preview
// traffic never pollutes real analytics.
import { after } from 'next/server'
import { PostHog } from 'posthog-node'
import type { AnalyticsEventName, ServerTrackPayload } from './events'
import { isInternalEmail } from '@/lib/superusers'

// VERCEL_ENV, not NODE_ENV. `next start` on a developer's machine also runs with
// NODE_ENV=production, so local test runs would send throwaway accounts and fake-key errors into
// the live project. VERCEL_ENV is "production" only on the real production deployment — previews
// and local builds report nothing.
const isProd = process.env.VERCEL_ENV === 'production'
const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY

let client: PostHog | null = null

function getClient(): PostHog | null {
  if (!isProd || !apiKey) return null
  if (!client) {
    client = new PostHog(apiKey, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      // Serverless functions can freeze right after the response is sent, so the default
      // batching (flush every 20 events / 10s) risks losing events. flushAt: 1 starts the
      // send at once; flushAfterResponse() keeps the function alive until it is done.
      flushAt: 1,
      flushInterval: 0,
    })
  }
  return client
}

// flushAt: 1 starts the send, but nothing waited for it: on the sister product (Florelis) the
// function froze as soon as the response left, and most server events never arrived (~30 renders
// in the database, under 10 in PostHog, no event at all for a subscription payment). `after`
// keeps the function alive until the send is done, once the response is already on its way, so
// the request is not slowed. Outside a request (a script) there is no `after`: the caller
// flushes or shuts the client down itself.
function flushAfterResponse(ph: PostHog): void {
  try {
    after(() => ph.flush().catch(() => {}))
  } catch {
    // not inside a request
  }
}

// Fire-and-forget: never throws, never awaited by callers, never blocks the request.
// `setOnce`: person properties written only if absent (first-touch attribution).
export function trackServerEvent<E extends AnalyticsEventName>(
  event: E,
  properties: ServerTrackPayload<E>,
  opts: { setOnce?: Record<string, unknown> } = {},
): void {
  const ph = getClient()
  if (!ph) return

  const { userId, email, plan, remainingCredits, workspaceId, ...rest } = properties as ServerTrackPayload<E> &
    Record<string, unknown>

  try {
    ph.capture({
      distinctId: userId,
      event,
      properties: {
        userId, email, plan, remainingCredits, workspaceId, ...rest,
        // Our own accounts are flagged so dashboards can filter them out.
        $set: { email, plan, ...(isInternalEmail(email) ? { is_internal: true } : {}) },
        ...(opts.setOnce ? { $set_once: opts.setOnce } : {}),
      },
    })
    flushAfterResponse(ph)
  } catch {
    // Analytics must never break the request it's attached to.
  }
}

export function captureServerException(error: unknown, userId?: string): void {
  const ph = getClient()
  if (!ph) return
  try {
    ph.captureException(error, userId)
    flushAfterResponse(ph)
  } catch {
    // no-op
  }
}

// For a handler whose events must not be lost when the function freezes right after its
// response (the Stripe webhook): waits until everything captured so far has been sent.
export async function flushServerAnalytics(): Promise<void> {
  try {
    await client?.flush()
  } catch {
    // no-op
  }
}

// Call from long-running scripts (one-off scripts) before the process exits so queued events
// flush. Not needed in request handlers: every capture is flushed after the response.
export async function shutdownServerAnalytics(): Promise<void> {
  if (client) await client._shutdown()
}
