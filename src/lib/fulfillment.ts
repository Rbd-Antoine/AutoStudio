// Turning a completed Stripe payment into a plan and credits. This is the ONLY place that
// happens, and it is safe to call as often as you like from as many triggers as you like.
//
// Why it exists (ported from Florelis): fulfilment used to live solely in the Stripe webhook,
// which made the webhook a single point of failure. In September 2026 a Florelis customer paid,
// the webhook endpoint pointed at a stale Vercel alias that answered with a redirect, and he sat
// on the FREE plan with zero credits for four days. Nothing alerted anyone. So fulfilment is now
// driven by several independent triggers:
//
//   1. the Stripe webhook            — normal path, arrives within seconds
//   2. the post-checkout page load   — safety net, runs when the customer lands back
//   3. any future replay/backfill    — same function, same guarantees
//
// They race on purpose. Exactly-once is enforced by the unique `fulfillmentKey` column on
// CreditTransaction: the winner inserts the ledger row, the loser's whole transaction rolls
// back on the constraint. Application code never asks "did someone already do this?", the
// check-then-act pattern that quietly double-grants under concurrency.
import type Stripe from 'stripe'
import { db } from './db'
import { getStripe, type SubscriptionPlan, type CreditPackId } from './stripe'
import { getPricingConfig, creditPacks, monthlyCreditsForPlan } from './pricing'

const PLAN_PRICE_ENV: Record<SubscriptionPlan, string> = {
  ESSENTIAL: 'STRIPE_PRICE_ESSENTIAL',
  PRO: 'STRIPE_PRICE_PRO',
  BUSINESS: 'STRIPE_PRICE_BUSINESS',
}

export interface FulfillmentOutcome {
  /** fulfilled = this call did the work; already_fulfilled = someone beat us to it (both are success) */
  status: 'fulfilled' | 'already_fulfilled' | 'skipped'
  /** only set on 'skipped', to say why nothing happened */
  reason?: string
  workspaceId?: string
  plan?: SubscriptionPlan
  previousPlan?: string
  planChanged?: boolean
  creditsGranted?: number
  totalCredits?: number
  userId?: string
  email?: string | null
}

// Prisma reports a unique-constraint violation as code P2002. Matched structurally rather than
// with instanceof so this doesn't depend on the generated client's error class identity.
function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2002'
}

// Stripe API 2025-03-31.basil moved the billing period onto each subscription item; webhook
// payloads follow the API version set on the endpoint in the dashboard, so both shapes are read.
// This value decides the renewal date *and* the period half of the idempotency key — getting it
// wrong would either re-grant credits on every event or never grant them again.
export function currentPeriodEnd(subscription: Stripe.Subscription): number | null {
  const sub = subscription as unknown as {
    current_period_end?: number
    items?: { data?: Array<{ current_period_end?: number }> }
  }
  return sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? null
}

// The invoice's subscription moved under parent.subscription_details in the same API version.
export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const shape = invoice as unknown as {
    subscription?: string | { id: string } | null
    parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null
  }
  const subscription = shape.subscription ?? shape.parent?.subscription_details?.subscription
  if (!subscription) return null
  return typeof subscription === 'string' ? subscription : subscription.id
}

// The price decides the plan; checkout's metadata is only a fallback. A plan switched in the
// Stripe customer portal keeps the metadata written at checkout, so reading it first would
// leave the workspace on its old plan.
export function planFromSubscription(subscription: Stripe.Subscription, fallback?: string): SubscriptionPlan | null {
  const priceId = subscription.items.data[0]?.price.id
  for (const plan of Object.keys(PLAN_PRICE_ENV) as SubscriptionPlan[]) {
    if (priceId && process.env[PLAN_PRICE_ENV[plan]] === priceId) return plan
  }
  const metaPlan = (subscription.metadata?.plan ?? fallback) as SubscriptionPlan | undefined
  if (metaPlan && metaPlan in PLAN_PRICE_ENV) return metaPlan
  return null
}

// Grants one billing period's worth of monthly credits, exactly once.
//
// The key carries the plan as well as the period so a mid-cycle upgrade (ESSENTIAL -> PRO,
// same period_end) correctly grants the new tier's allotment instead of being mistaken for a
// replay of the event already processed.
async function grantSubscriptionPeriod(params: {
  workspaceId: string
  plan: SubscriptionPlan
  subscriptionId: string
  periodEndUnix: number
}): Promise<{ granted: boolean; credits: number; total: number }> {
  const config = await getPricingConfig()
  const fresh = monthlyCreditsForPlan(config, params.plan)
  const key = `sub:${params.subscriptionId}:${params.periodEndUnix}:${params.plan}`

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.workspace.update({
        where: { id: params.workspaceId },
        data: {
          monthlyCredits: fresh,
          lastCreditReset: new Date(),
          // A fresh cycle is a fresh chance to hit the wall again.
          creditsExhaustedEmailSentAt: null,
          creditsExhaustedFollowupSentAt: null,
        },
        select: { monthlyCredits: true, bonusCredits: true },
      })
      // Inserted second but it is still the gate: a duplicate key aborts the whole
      // transaction, rolling the credit write above back with it.
      await tx.creditTransaction.create({
        data: {
          workspaceId: params.workspaceId,
          delta: fresh,
          balanceAfter: updated.monthlyCredits + updated.bonusCredits,
          reason: 'MONTHLY_RESET',
          bucket: 'monthly',
          fulfillmentKey: key,
          notes: `Monthly credits set to ${fresh} for plan ${params.plan}`,
        },
      })
      return { granted: true, credits: fresh, total: updated.monthlyCredits + updated.bonusCredits }
    })
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    const ws = await db.workspace.findUnique({
      where: { id: params.workspaceId },
      select: { monthlyCredits: true, bonusCredits: true },
    })
    return { granted: false, credits: 0, total: (ws?.monthlyCredits ?? 0) + (ws?.bonusCredits ?? 0) }
  }
}

// Applies a subscription's current state to its workspace: plan, status, renewal date, and the
// current period's credits. Safe to call on subscription.created, subscription.updated,
// invoice.paid, or from the post-checkout reconciliation — whichever happens to arrive.
export async function fulfillSubscription(
  subscription: Stripe.Subscription,
  opts: { fallbackMetadata?: Stripe.Metadata | null } = {},
): Promise<FulfillmentOutcome> {
  const meta = { ...(opts.fallbackMetadata ?? {}), ...(subscription.metadata ?? {}) }
  const workspaceId = meta.workspaceId
  if (!workspaceId) return { status: 'skipped', reason: 'no workspaceId in subscription or session metadata' }

  const plan = planFromSubscription(subscription, meta.plan)
  if (!plan) return { status: 'skipped', reason: `could not resolve plan for subscription ${subscription.id}` }

  const periodEndUnix = currentPeriodEnd(subscription)
  if (!periodEndUnix) return { status: 'skipped', reason: `no current_period_end on subscription ${subscription.id}` }

  const existing = await db.workspace.findUnique({ where: { id: workspaceId }, select: { plan: true } })
  if (!existing) return { status: 'skipped', reason: `workspace ${workspaceId} not found` }

  const previousPlan = existing.plan
  const planChanged = previousPlan !== plan

  // Always re-synced, never gated: writing the same values twice costs nothing, and it
  // self-heals a row that drifted while the webhook was down.
  await db.workspace.update({
    where: { id: workspaceId },
    data: {
      plan,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      renewalDate: new Date(periodEndUnix * 1000),
      // Kept in sync here too, so a cancellation made from Stripe's own portal (or undone
      // there) is reflected in the app rather than only the one made via our button.
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    },
  })

  // Credits are only for a subscription that is actually paid for. A subscription can exist in
  // `incomplete` (payment not confirmed yet, e.g. mid-3DS) or `past_due` (renewal payment
  // failed) — granting there would hand out credits for money that never arrived. The plan
  // fields above are still synced, and the grant happens on the subscription.updated /
  // invoice.paid event that follows once the payment actually clears.
  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    return {
      status: 'skipped',
      reason: `subscription ${subscription.id} is "${subscription.status}", not paid for`,
      workspaceId, plan, previousPlan, planChanged,
      userId: meta.userId,
      email: meta.email || null,
    }
  }

  const { granted, credits, total } = await grantSubscriptionPeriod({
    workspaceId,
    plan,
    subscriptionId: subscription.id,
    periodEndUnix,
  })

  return {
    status: granted ? 'fulfilled' : 'already_fulfilled',
    workspaceId, plan, previousPlan, planChanged,
    creditsGranted: credits,
    totalCredits: total,
    userId: meta.userId,
    email: meta.email || null,
  }
}

// Grants a one-time credit pack, exactly once, keyed on the Checkout session that paid for it.
async function fulfillPackPurchase(session: Stripe.Checkout.Session): Promise<FulfillmentOutcome> {
  const workspaceId = session.metadata?.workspaceId
  const pack = session.metadata?.pack as CreditPackId | undefined
  if (!workspaceId || !pack) return { status: 'skipped', reason: 'checkout session missing workspaceId/pack metadata' }

  const config = await getPricingConfig()
  const packDef = creditPacks(config).find(p => p.id === pack)
  if (!packDef) return { status: 'skipped', reason: `unknown pack "${pack}"` }

  const key = `pack:${session.id}`

  try {
    const total = await db.$transaction(async (tx) => {
      const updated = await tx.workspace.update({
        where: { id: workspaceId },
        // Incremented rather than computed-then-set so a concurrent spend can't be lost.
        data: {
          bonusCredits: { increment: packDef.credits },
          creditsExhaustedEmailSentAt: null,
          creditsExhaustedFollowupSentAt: null,
        },
        select: { monthlyCredits: true, bonusCredits: true },
      })
      await tx.creditTransaction.create({
        data: {
          workspaceId,
          delta: packDef.credits,
          balanceAfter: updated.monthlyCredits + updated.bonusCredits,
          reason: 'PACK_PURCHASE',
          bucket: 'bonus',
          fulfillmentKey: key,
          stripeInvoiceId: typeof session.payment_intent === 'string' ? session.payment_intent : session.id,
          notes: `Credit pack purchase: ${pack} (${packDef.credits} credits)`,
        },
      })
      return updated.monthlyCredits + updated.bonusCredits
    })

    return {
      status: 'fulfilled',
      workspaceId,
      creditsGranted: packDef.credits,
      totalCredits: total,
      userId: session.metadata?.userId,
      email: session.metadata?.email || null,
    }
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    const ws = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { monthlyCredits: true, bonusCredits: true },
    })
    return {
      status: 'already_fulfilled',
      workspaceId,
      creditsGranted: 0,
      totalCredits: (ws?.monthlyCredits ?? 0) + (ws?.bonusCredits ?? 0),
      userId: session.metadata?.userId,
      email: session.metadata?.email || null,
    }
  }
}

// Entry point for "this Checkout session is paid — make the account reflect it", whichever
// mode it was. Used by the webhook and by the post-checkout reconciliation. With a delayed
// payment method (SEPA debit) the session completes 'unpaid': it is skipped then, and granted on
// checkout.session.async_payment_succeeded, which calls this again once the money has arrived.
export async function fulfillCheckoutSession(session: Stripe.Checkout.Session): Promise<FulfillmentOutcome> {
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
    return { status: 'skipped', reason: `session ${session.id} is not paid (${session.payment_status})` }
  }

  if (session.mode === 'payment') return fulfillPackPurchase(session)

  if (session.mode === 'subscription') {
    const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
    if (!subId) return { status: 'skipped', reason: `subscription session ${session.id} has no subscription` }
    const subscription = await getStripe().subscriptions.retrieve(subId)
    // The session's own metadata is passed as a fallback so a subscription that somehow lost
    // its metadata still resolves to the right workspace instead of failing silently.
    return fulfillSubscription(subscription, { fallbackMetadata: session.metadata })
  }

  return { status: 'skipped', reason: `unsupported checkout mode "${session.mode}"` }
}
