import { NextResponse } from 'next/server'
import { getSessionOrDevBypass } from '@/lib/dev-auth'
import { db } from '@/lib/db'
import { isSuperuserAccount } from '@/lib/superusers'


export async function GET() {
  const session = await getSessionOrDevBypass()
  if (!await isSuperuserAccount(session?.user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const feedback = await db.creditFeedback.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { email: true, name: true } },
      workspace: { select: { name: true, plan: true } },
    },
  })

  return NextResponse.json({
    feedback: feedback.map(f => ({
      id: f.id,
      message: f.message,
      rating: f.rating,
      createdAt: f.createdAt,
      email: f.user.email,
      name: f.user.name,
      workspaceName: f.workspace.name,
      plan: f.workspace.plan,
    })),
  })
}
