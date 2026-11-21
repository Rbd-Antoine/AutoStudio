import type Stripe from 'stripe'
import { db } from '@/lib/db'
import type { FulfillmentOutcome } from '@/lib/fulfillment'
import { trackServerEvent } from '@/lib/analytics/server'
import { ANALYTICS_EVENTS } from '@/lib/analytics/events'

type StripeCustomerRef = string | Stripe.Customer | Stripe.DeletedCustomer | null

/**
 * Payment Completed, sent by whichever call actually fulfilled a payment — a Stripe webhook
 * event or the post-checkout safety net (/api/billing/fulfill). The fulfilment key makes that
 * exactly once per paid period or pack, however many of them arrive.
 */
export async function trackPaymentCompleted(outcome: FulfillmentOutcome, payment: {
  kind: 'subscription' | 'pack'
  amountCents: number | null | undefined
  currency: string | null | undefined
  customer: StripeCustomerRef
}): Promise<void> {
  if (outcome.status !== 'fulfilled' || !outcome.userId || !outcome.workspaceId) return
  const [workspace, paidPeriods] = await Promise.all([
    db.workspace.findUnique({ where: { id: outcome.workspaceId }, select: { plan: true } }),
    // Every paid allotment carries a fulfilment key, this one included.
    db.creditTransaction.count({ where: { workspaceId: outcome.workspaceId, fulfillmentKey: { not: null } } }),
  ])
  trackServerEvent(ANALYTICS_EVENTS.PAYMENT_COMPLETED, {
    userId: outcome.userId,
    email: outcome.email ?? null,
    plan: outcome.plan ?? workspace?.plan ?? 'FREE',
    remainingCredits: outcome.totalCredits ?? 0,
    workspaceId: outcome.workspaceId,
    kind: payment.kind,
    amount_eur: payment.amountCents != null ? payment.amountCents / 100 : null,
    currency: (payment.currency ?? 'eur').toUpperCase(),
    stripe_customer_id: typeof payment.customer === 'string' ? payment.customer : payment.customer?.id ?? null,
    is_first_payment: paidPeriods <= 1,
  })
}

/** For a fulfilled Checkout session, from either path. */
export function trackCheckoutPayment(outcome: FulfillmentOutcome, session: Stripe.Checkout.Session): Promise<void> {
  return trackPaymentCompleted(outcome, {
    kind: session.mode === 'payment' ? 'pack' : 'subscription',
    amountCents: session.amount_total, currency: session.currency, customer: session.customer,
  })
}
