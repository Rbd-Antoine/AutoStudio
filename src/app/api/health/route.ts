import { NextResponse } from 'next/server'
import { IGNORED_AUTH_URLS } from '@/lib/auth-url-guard'
import { IMAGE_MODEL } from '@/lib/gemini'

// Public, read-only deployment check, used by scripts/check-production.ts and docs/mise-en-ligne.md.
// It says which commit is live and which environment variables exist, as booleans: never a
// value, a length or a prefix. Nothing here is more than other routes already reveal (the cron
// and Stripe webhook routes answer "not configured" when their secret is missing), and it calls
// no external service, so hitting it repeatedly costs nothing.

export const dynamic = 'force-dynamic'

// Without these the site is broken somewhere: sign-in, emails, payments, renders or the crons.
const REQUIRED = [
  'DATABASE_URL',
  'AUTH_SECRET',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'GEMINI_API_KEY',
  'BLOB_READ_WRITE_TOKEN',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ESSENTIAL',
  'STRIPE_PRICE_PRO',
  'STRIPE_PRICE_BUSINESS',
  'STRIPE_PRICE_PACK_50',
  'STRIPE_PRICE_PACK_150',
  'STRIPE_PRICE_PACK_400',
  'CRON_SECRET',
] as const

// The site works without them: Google sign-in (the button hides), videos, analytics, ads.
const OPTIONAL = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_CONTACT_EMAIL',
  'SHOTSTACK_API_KEY',
  'NEXT_PUBLIC_POSTHOG_KEY',
  'NEXT_PUBLIC_POSTHOG_HOST',
  'NEXT_PUBLIC_META_PIXEL_ID',
  'META_CAPI_ACCESS_TOKEN',
  'OPS_ALERT_EMAIL',
  'VEHICLE_PROTECTION_URL',
  'VEHICLE_PROTECTION_TOKEN',
] as const

function present(key: string): boolean {
  if (key === 'AUTH_SECRET') return !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET)
  return !!process.env[key]
}

function nextauthUrl(): string {
  const ignored = IGNORED_AUTH_URLS.find(i => i.key === 'NEXTAUTH_URL' || i.key === 'AUTH_URL')
  if (ignored) return `ignored: ${ignored.value}`
  return process.env.NEXTAUTH_URL || process.env.AUTH_URL || 'missing'
}

export function GET() {
  const required = Object.fromEntries(REQUIRED.map(k => [k, present(k)]))
  const optional = Object.fromEntries(OPTIONAL.map(k => [k, present(k)]))

  return NextResponse.json(
    {
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      environment: process.env.VERCEL_ENV ?? null,
      nextauthUrl: nextauthUrl(),
      imageModel: IMAGE_MODEL,
      // Inert on Vercel (dev-auth-flag.ts requires `next dev`), but its presence means the local
      // .env was pasted into the project as is: worth removing, with whatever else came with it.
      devAuthBypass: !!process.env.DEV_AUTH_BYPASS,
      missingRequired: REQUIRED.filter(k => !present(k)),
      required,
      optional,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
