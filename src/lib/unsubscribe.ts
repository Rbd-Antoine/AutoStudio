// Signed, stateless unsubscribe links (ported from Florelis). The token is an HMAC of the user
// id, so a link can only ever unsubscribe the person it was sent to — nobody can unsubscribe
// someone else by guessing ids — and no token table has to be stored or expired. Links never
// expire on purpose: an unsubscribe link in a two-year-old email must still work.
import crypto from 'node:crypto'
import { SITE_URL } from './site-config'

// Domain-separated from every other use of the secret, so this signature can't be replayed
// anywhere AUTH_SECRET signs something else. Never change it: every link already sitting in an
// inbox would stop working. (Rotating AUTH_SECRET has the same effect.)
const PURPOSE = 'autostudio:marketing-unsubscribe:v1'

function secret(): string {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET is not set')
  return s
}

export function unsubscribeToken(userId: string): string {
  return crypto.createHmac('sha256', secret()).update(`${PURPOSE}:${userId}`).digest('base64url')
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  if (!userId || !token) return false
  const expected = Buffer.from(unsubscribeToken(userId))
  const given = Buffer.from(token)
  return expected.length === given.length && crypto.timingSafeEqual(expected, given)
}

export function unsubscribeLinks(userId: string, base = SITE_URL) {
  const q = `u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId)}`
  return {
    // What a person clicks in the email body.
    page: `${base}/unsubscribe?${q}`,
    // RFC 8058 one-click target: Gmail/Yahoo POST here from their own "Unsubscribe" button.
    oneClick: `${base}/api/unsubscribe?${q}`,
  }
}
