import { NextRequest, NextResponse } from 'next/server'
import { getSessionOrDevBypass } from '@/lib/dev-auth'
import { db } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { SITE_URL } from '@/lib/site-config'

export async function POST(req: NextRequest) {
  const session = await getSessionOrDevBypass()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { workspaceId } = await req.json()

  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
    include: { workspace: true },
  })

  if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!member.workspace.stripeCustomerId) {
    return NextResponse.json({ error: 'This workspace has no billing history yet' }, { status: 400 })
  }

  try {
    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: member.workspace.stripeCustomerId,
      return_url: `${SITE_URL}/app/billing`,
    })
    return NextResponse.json({ url: portalSession.url })
  } catch (err) {
    // Typically the customer portal not yet configured in the Stripe dashboard, or no key.
    console.error('[billing/portal] could not open the customer portal:', err)
    return NextResponse.json({ error: 'Le portail de facturation est momentanément indisponible.' }, { status: 503 })
  }
}
