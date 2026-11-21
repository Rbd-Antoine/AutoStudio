import crypto from 'node:crypto'
import { NextResponse } from 'next/server'

// Vercel Cron calls these routes with `Authorization: Bearer $CRON_SECRET` as soon as that
// variable exists in the project. Every route checks it through here so the rule lives in one
// place, and so that a missing secret closes the routes instead of opening them: the previous
// per-route check, `if (secret && header !== …)`, let anyone run the jobs whenever the variable
// was unset.
//
// Returns null when the request may proceed, otherwise the response to send back.
export function rejectUnauthorizedCron(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET

  if (!secret) {
    // Local development only; in production a missing secret is a misconfiguration to surface
    // (the failed run shows up in Vercel's cron logs), not a reason to run unauthenticated.
    if (process.env.NODE_ENV !== 'production') return null
    console.error('[cron] CRON_SECRET is not set: refusing to run')
    return NextResponse.json({ error: 'CRON_SECRET non configuré' }, { status: 500 })
  }

  const given = Buffer.from(req.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  const ok = given.length === expected.length && crypto.timingSafeEqual(given, expected)
  return ok ? null : NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
}
