import { NextRequest, NextResponse } from 'next/server'
import { getSessionOrDevBypass } from '@/lib/dev-auth'
import { db } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { currentPeriodEnd } from '@/lib/fulfillment'
import { trackServerEvent, captureServerException } from '@/lib/analytics/server'
import { ANALYTICS_EVENTS } from '@/lib/analytics/events'

// Cancels (or un-cancels) a subscription from inside the app, without sending the customer out
// to Stripe's portal — which only offers cancellation if that happens to be switched on in the
// portal's configuration. Someone who wants to leave should never have to hunt for the exit.
//
// Always cancels at period end, never immediately: the month is already paid for, so the
// customer keeps their plan and credits until the renewal date and only then drops to FREE.
// Stripe leaves the subscription "active" during that window and fires
// customer.subscription.deleted when it truly ends, which the webhook already handles.
export async function POST(req: NextRequest) {
  const session = await getSessionOrDevBypass()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { workspaceId, resume } = (await req.json().catch(() => ({}))) as { workspaceId?: string; resume?: boolean }
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId requis' }, { status: 400 })
  }

  const member = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
    include: { workspace: true },
  })

  // Same bar as starting a subscription: only an owner or admin can end one.
  if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const subscriptionId = member.workspace.stripeSubscriptionId
  if (!subscriptionId) {
    return NextResponse.json({ error: 'no_subscription', message: "Aucun abonnement en cours sur cet espace." }, { status: 400 })
  }

  const cancelAtPeriodEnd = !resume

  try {
    const subscription = await getStripe().subscriptions.update(subscriptionId, { cancel_at_period_end: cancelAtPeriodEnd })

    // Stripe is the source of truth for the resulting state, so the flag and the end date are
    // read back off the updated subscription rather than assumed.
    const periodEnd = currentPeriodEnd(subscription)
    const updated = await db.workspace.update({
      where: { id: workspaceId },
      data: {
        cancelAtPeriodEnd: subscription.cancel_at_period_end ?? cancelAtPeriodEnd,
        subscriptionStatus: subscription.status,
        ...(periodEnd ? { renewalDate: new Date(periodEnd * 1000) } : {}),
      },
      select: { plan: true, monthlyCredits: true, bonusCredits: true, renewalDate: true, cancelAtPeriodEnd: true },
    })

    trackServerEvent(ANALYTICS_EVENTS.SUBSCRIPTION_CANCEL_SCHEDULED, {
      userId: session.user.id,
      email: session.user.email ?? null,
      plan: updated.plan,
      remainingCredits: updated.monthlyCredits + updated.bonusCredits,
      workspaceId,
      resumed: !cancelAtPeriodEnd,
      endsAt: updated.renewalDate?.toISOString() ?? null,
    })

    return NextResponse.json({ cancelAtPeriodEnd: updated.cancelAtPeriodEnd, renewalDate: updated.renewalDate, plan: updated.plan })
  } catch (err) {
    console.error('[billing/cancel]', err instanceof Error ? err.message : err)
    captureServerException(err, session.user.id)
    return NextResponse.json({ error: "L'annulation n'a pas pu être enregistrée. Réessayez, ou écrivez-nous." }, { status: 500 })
  }
}
