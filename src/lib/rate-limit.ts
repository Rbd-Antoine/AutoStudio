import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Abuse protection for the public endpoints (sign-up, password reset, contact form, free AI
// calls), backed by the database so it holds across serverless instances without another
// service. Count-then-insert isn't atomic: two simultaneous requests at the edge of a limit can
// both pass, which is acceptable for throttling.

export const MINUTE = 60 * 1000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

// Rows older than the longest window in use are useless; the daily purge cron deletes them.
export const RATE_LIMIT_RETENTION_MS = 2 * DAY

// Vercel sets x-forwarded-for to the real client address (it overwrites what the client sends).
export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
}

// Records one attempt under `key` and returns false once `limit` attempts happened within
// `windowMs`. Refused attempts aren't recorded, so the caller is let through again as soon as the
// oldest counted attempt leaves the window.
export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const recent = await db.rateLimitHit.count({
    where: { key, createdAt: { gt: new Date(Date.now() - windowMs) } },
  })
  if (recent >= limit) return false
  await db.rateLimitHit.create({ data: { key } })
  return true
}

export function tooManyRequests(message = 'Trop de tentatives. Réessayez dans quelques minutes.') {
  return NextResponse.json({ error: message }, { status: 429 })
}
