import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyUnsubscribeToken } from '@/lib/unsubscribe'

// Opt out of (or back into) commercial email. Two callers:
//   - mail clients honouring RFC 8058, which POST `List-Unsubscribe=One-Click` to the URL in the
//     List-Unsubscribe header, with the user id and token in the query string;
//   - the /unsubscribe page, which POSTs JSON.
// Deliberately POST-only. Corporate mail scanners and link previewers GET every URL in an
// email, and a GET that unsubscribed would silently opt people out who never clicked anything.
export async function POST(req: NextRequest) {
  let userId = req.nextUrl.searchParams.get('u') ?? ''
  let token = req.nextUrl.searchParams.get('t') ?? ''
  let resubscribe = false

  if (req.headers.get('content-type')?.includes('application/json')) {
    const body = (await req.json().catch(() => ({}))) as { u?: string; t?: string; action?: string }
    userId = body.u ?? userId
    token = body.t ?? token
    resubscribe = body.action === 'resubscribe'
  }

  // Same response whether the id is unknown or the token is wrong: this endpoint must not reveal
  // which ids belong to real accounts.
  if (!verifyUnsubscribeToken(userId, token)) {
    return NextResponse.json({ error: 'invalid_link' }, { status: 400 })
  }

  if (resubscribe) {
    await db.user.updateMany({ where: { id: userId }, data: { marketingUnsubscribedAt: null } })
  } else {
    // Only stamp a first opt-out, so repeat clicks don't overwrite when they actually left.
    await db.user.updateMany({
      where: { id: userId, marketingUnsubscribedAt: null },
      data: { marketingUnsubscribedAt: new Date() },
    })
  }

  return NextResponse.json({ subscribed: resubscribe })
}
