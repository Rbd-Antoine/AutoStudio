import { IS_DEPLOYMENT, isLocalHost } from './site-config'

// Auth.js builds every URL it hands out from AUTH_URL or NEXTAUTH_URL whenever one is set, and
// ignores the address the request actually came in on: Google's redirect_uri, the middleware's
// redirect to /signin, the page a sign-in returns to. A value naming localhost is right on a
// developer's machine and always a mistake on a deployment, where it means .env was pasted into
// Vercel as is (.env.example ships NEXTAUTH_URL="http://localhost:3000"). Google then refuses
// every sign-in, and visitors to /app are sent to an address only the developer's laptop
// answers. On a deployment such a value is dropped, so Auth.js falls back to the request's own
// host, which Vercel only routes for domains attached to the project. (Ported from Florelis,
// where exactly this broke Google sign-in and every emailed link on 2026-10-21.)
//
// Imported for its side effect, first, by both Auth.js entry points: src/auth.ts (route handlers)
// and src/auth.config.ts (middleware). Both read these variables per request, not at build time.

/** What was dropped, so /api/health can say so: the variable alone stays unset afterwards. */
export const IGNORED_AUTH_URLS: { key: string; value: string }[] = []

for (const key of ['AUTH_URL', 'NEXTAUTH_URL'] as const) {
  const value = process.env[key]
  if (!IS_DEPLOYMENT || !value) continue

  let host = ''
  try {
    host = new URL(value).hostname
  } catch {
    continue // unparsable: leave it to Auth.js to report
  }
  if (!isLocalHost(host)) continue

  console.error(`[auth] ${key}=${value} on a ${process.env.VERCEL_ENV} deployment: ignored. Set it to the public URL in Vercel.`)
  IGNORED_AUTH_URLS.push({ key, value })
  try {
    delete process.env[key]
  } catch {
    // A runtime that freezes process.env keeps the bad value; the error above still says why.
  }
}
