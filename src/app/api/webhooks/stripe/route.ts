import { NextRequest, NextResponse, after } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { resetMonthlyCredits, getAvailableCredits } from '@/lib/credits'
import { fulfillCheckoutSession, fulfillSubscription, invoiceSubscriptionId } from '@/lib/fulfillment'
import { trackCheckoutPayment, trackPaymentCompleted } from '@/lib/payment-analytics.server'
import { trackServerEvent, captureServerException, flushServerAnalytics } from '@/lib/analytics/server'
import { ANALYTICS_EVENTS } from '@/lib/analytics/events'
import { sendInvoiceEmail } from '@/lib/email'

// Stripe requires the raw, unparsed request body to verify the webhook signature.
export const runtime = 'nodejs'

// Every handler below delegates the actual "give them what they paid for" work to
// src/lib/fulfillment.ts, which is idempotent. That is what lets several event types map onto
// the same fulfilment without double-granting — checkout.session.completed,
// customer.subscription.created and invoice.paid all describe the same purchase, and whichever
// arrives first (or arrives at all) is enough. Analytics and receipts, by contrast, only fire on
// the call that actually did the work, so a Stripe retry never double-counts revenue.

const euros = (cents: number | null | undefined) =>
  cents ? `${(cents / 100).toFixed(2).replace('.', ',')} €` : '—'
const today = () => new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

async function handleSubscriptionUpsert(subscription: Stripe.Subscription, eventType: 'created' | 'updated') {
  const outcome = await fulfillSubscription(subscription)
  if (outcome.status === 'skipped') {
    console.warn('[webhooks/stripe] subscription not fulfilled:', outcome.reason)
    return
  }
  const price = subscription.items.data[0]?.price
  await trackPaymentCompleted(outcome, {
    kind: 'subscription', amountCents: price?.unit_amount, currency: price?.currency, customer: subscription.customer,
  })

  const { userId, email, plan, previousPlan, planChanged, totalCredits, workspaceId } = outcome
  if (!userId || !plan) return

  const identity = { userId, email: email ?? null, plan, remainingCredits: totalCredits ?? 0, workspaceId }
  if (eventType === 'created' && outcome.status === 'fulfilled') {
    trackServerEvent(ANALYTICS_EVENTS.SUBSCRIPTION_PURCHASED, { ...identity, amount: price?.unit_amount ?? undefined })
  } else if (planChanged && previousPlan) {
    trackServerEvent(ANALYTICS_EVENTS.UPGRADE_SUBSCRIPTION, { ...identity, fromPlan: previousPlan, toPlan: plan })
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const workspaceId = subscription.metadata?.workspaceId
  if (!workspaceId) return

  const workspace = await db.workspace.findUnique({ where: { id: workspaceId }, select: { plan: true } })

  await db.workspace.update({
    where: { id: workspaceId },
    data: { plan: 'FREE', subscriptionStatus: 'canceled', stripeSubscriptionId: null, cancelAtPeriodEnd: false },
  })
  await resetMonthlyCredits(workspaceId)

  const userId = subscription.metadata?.userId
  if (!userId) return
  const remainingCredits = (await getAvailableCredits(workspaceId)).total
  const endedAt = subscription.ended_at ?? Math.floor(Date.now() / 1000)
  trackServerEvent(ANALYTICS_EVENTS.CANCEL_SUBSCRIPTION, {
    userId,
    email: subscription.metadata?.email || null,
    plan: 'FREE', // workspace is downgraded to FREE by this point
    remainingCredits,
    workspaceId,
    cancelledPlan: workspace?.plan ?? 'FREE', // the plan they were on before cancelling
    ...(subscription.start_date ? { durationDays: Math.round((endedAt - subscription.start_date) / 86400) } : {}),
  })
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = invoiceSubscriptionId(invoice)
  if (!subscriptionId) return
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId)

  // Run for every paid invoice, not just renewals. The first invoice of a new subscription
  // resolves to the same fulfilment key as customer.subscription.created and is therefore a
  // no-op, while a renewal carries a new billing period and grants a fresh allotment. That
  // means a renewal still lands even if the subscription.updated event is lost.
  const outcome = await fulfillSubscription(subscription)
  if (outcome.status === 'skipped') {
    console.warn('[webhooks/stripe] invoice.paid not fulfilled:', outcome.reason)
    return
  }
  await trackPaymentCompleted(outcome, {
    kind: 'subscription', amountCents: invoice.amount_paid, currency: invoice.currency, customer: invoice.customer,
  })

  const isRenewal = invoice.billing_reason === 'subscription_cycle'
  if (!isRenewal || outcome.status !== 'fulfilled') return

  if (outcome.userId && outcome.plan) {
    trackServerEvent(ANALYTICS_EVENTS.SUBSCRIPTION_RENEWED, {
      userId: outcome.userId,
      email: outcome.email ?? null,
      plan: outcome.plan,
      remainingCredits: outcome.totalCredits ?? 0,
      workspaceId: outcome.workspaceId,
      amount: invoice.amount_paid ?? undefined,
    })
  }
  const email = outcome.email
  if (email) {
    after(() => sendInvoiceEmail(email, {
      invoiceNumber: invoice.number ?? `INV-${Date.now()}`,
      date: today(),
      description: `Abonnement ${outcome.plan ?? 'AutoStudio'} — renouvellement mensuel`,
      amountEur: euros(invoice.amount_paid),
      receiptUrl: invoice.hosted_invoice_url ?? undefined,
    }))
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoiceSubscriptionId(invoice)
  let workspaceId: string | undefined
  let userId: string | undefined
  let email: string | null = null
  let plan = 'FREE'

  if (subscriptionId) {
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId)
    workspaceId = subscription.metadata?.workspaceId
    userId = subscription.metadata?.userId
    email = subscription.metadata?.email || null
    if (workspaceId) {
      await db.workspace.update({ where: { id: workspaceId }, data: { subscriptionStatus: subscription.status } }).catch(() => {})
      const ws = await db.workspace.findUnique({ where: { id: workspaceId }, select: { plan: true } })
      plan = ws?.plan ?? 'FREE'
    }
  }

  if (!userId) {
    console.warn('[webhooks/stripe] payment_failed with no attributable userId', invoice.id)
    return
  }

  const remainingCredits = workspaceId ? (await getAvailableCredits(workspaceId)).total : 0
  trackServerEvent(ANALYTICS_EVENTS.PAYMENT_FAILED, {
    userId,
    email,
    plan,
    remainingCredits,
    workspaceId,
    reason: invoice.last_finalization_error?.message ?? 'unknown',
    amount: invoice.amount_due,
  })
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Handles subscriptions too, not just credit packs. A subscription checkout is normally
  // fulfilled by customer.subscription.created, but running it here as well means a purchase
  // survives losing either event — the fulfilment key makes the duplicate free.
  const outcome = await fulfillCheckoutSession(session)
  if (outcome.status === 'skipped') {
    console.warn('[webhooks/stripe] checkout not fulfilled:', outcome.reason)
    return
  }
  await trackCheckoutPayment(outcome, session)

  if (session.mode !== 'payment') return // subscription analytics fire on the subscription events
  if (outcome.status !== 'fulfilled' || !outcome.userId || !outcome.workspaceId) return

  const workspace = await db.workspace.findUnique({ where: { id: outcome.workspaceId }, select: { plan: true } })
  const identity = {
    userId: outcome.userId,
    email: outcome.email ?? null,
    plan: workspace?.plan ?? 'FREE',
    remainingCredits: outcome.totalCredits ?? 0,
    workspaceId: outcome.workspaceId,
  }
  trackServerEvent(ANALYTICS_EVENTS.CREDIT_PACK_PURCHASED, {
    ...identity,
    pack: session.metadata?.pack ?? 'unknown',
    credits: outcome.creditsGranted ?? 0,
    amount: session.amount_total ?? undefined,
  })
  trackServerEvent(ANALYTICS_EVENTS.CREDITS_PURCHASED, { ...identity, amount: outcome.creditsGranted ?? 0, source: 'pack' })

  const email = outcome.email
  if (email) {
    after(() => sendInvoiceEmail(email, {
      invoiceNumber: `INV-${Date.now()}`,
      date: today(),
      description: `Pack crédits — ${outcome.creditsGranted ?? 0} crédits`,
      amountEur: euros(session.amount_total),
    }))
  }
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid signature'
    console.error('[webhooks/stripe] signature verification failed:', msg)
    // Captured, not just logged: a signature that stops verifying (rotated secret, wrong
    // endpoint) silently breaks every payment — exactly how Florelis's September 2026 incident
    // stayed invisible for four days.
    captureServerException(err)
    await flushServerAnalytics()
    return NextResponse.json({ error: `Webhook signature verification failed: ${msg}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case 'customer.subscription.created':
        await handleSubscriptionUpsert(event.data.object as Stripe.Subscription, 'created')
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpsert(event.data.object as Stripe.Subscription, 'updated')
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break
      default:
        // Unhandled event types are expected — Stripe sends many we don't act on.
        break
    }
  } catch (err) {
    console.error(`[webhooks/stripe] handler error for ${event.type}:`, err)
    captureServerException(err)
    await flushServerAnalytics()
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  // Revenue events are the ones that must not be lost to a function frozen after its response.
  await flushServerAnalytics()
  return NextResponse.json({ received: true })
}
