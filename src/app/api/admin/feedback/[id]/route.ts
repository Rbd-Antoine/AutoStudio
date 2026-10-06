import { NextRequest, NextResponse } from 'next/server'
import { getSessionOrDevBypass } from '@/lib/dev-auth'
import { db } from '@/lib/db'
import { isSuperuserAccount } from '@/lib/superusers'


export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrDevBypass()
  if (!await isSuperuserAccount(session?.user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  await db.creditFeedback.delete({ where: { id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
