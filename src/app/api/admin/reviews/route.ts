import { NextResponse } from 'next/server'
import { getSessionOrDevBypass } from '@/lib/dev-auth'
import { db } from '@/lib/db'
import { isSuperuserAccount } from '@/lib/superusers'


export async function GET() {
  const session = await getSessionOrDevBypass()
  if (!await isSuperuserAccount(session?.user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const reviews = await db.review.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true } } },
  })

  return NextResponse.json({
    reviews: reviews.map(r => ({
      id: r.id,
      quote: r.quote,
      stars: r.stars,
      displayName: r.displayName,
      role: r.role,
      location: r.location,
      approved: r.approved,
      createdAt: r.createdAt,
      email: r.user.email,
    })),
  })
}
