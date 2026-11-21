import { NextRequest, NextResponse, after } from 'next/server'
import { getSessionOrDevBypass } from '@/lib/dev-auth'
import { db } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { fulfillCheckoutSession } from '@/lib/fulfillment'
import { trackCheckoutPayment } from '@/lib/payment-analytics.server'
import { trackServerEvent, captureServerException, flushServerAnalytics } from '@/lib/analytics/server'
import { ANALYTICS_EVENTS } from '@/lib/analytics/events'
import { sendInvoiceEmail, sendWebhookFallbackAlert } from '@/lib/email'

// The safety net. Called by the billing page the moment a customer lands back from Stripe, so
// that getting what they paid for never depends on the webhook having worked. Stripe itself is
// the source of truth here — we only ever act on a session Stripe reports as paid — and the
// work is the same idempotent fulfilment the webhook runs, so the two racing is harmless.

// A customer can genuinely outrun the webhook: Stripe redirects the browser back immediately
// while the webhook is still in flight, so the fallback winning by a second or two is normal
// and not worth an email. Past this threshold the webhook is not simply late, it is broken.
const WEBHOOK_GRACE_SECONDS = 60

export async function POST(req: NextRequest) {
  const session = await getSessionOrDevBypass()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { sessionId } = (await req.json().catch(() => ({}))) as { sessionId?: string }
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  }

  try {
    const checkoutSession = await getStripe().checkout.sessions.retrieve(sessionId)

    // A checkout session may only ever be reconciled by the user who started it.
    if (checkoutSession.metadata?.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const outcome = await fulfillCheckoutSession(checkoutSession)

    // 'fulfilled' here means the webhook had not already done it — the whole reason this
    // endpoint exists. Worth a signal every time, and a real alert once the webhook is late
    // enough that it clearly is not coming.
    if (outcome.status === 'fulfilled') {
      await trackCheckoutPayment(outcome, checkoutSession)
      const secondsSinceCheckout = Math.max(0, Math.floor(Date.now() / 1000) - checkoutSession.created)

      trackServerEvent(ANALYTICS_EVENTS.CHECKOUT_RECONCILED, {
        userId: session.user.id,
        email: session.user.email ?? null,
        plan: outcome.plan ?? 'FREE',
        remainingCredits: outcome.totalCredits ?? 0,
        workspaceId: outcome.workspaceId,
        mode: checkoutSession.mode ?? 'unknown',
        secondsSinceCheckout,
        creditsGranted: outcome.creditsGranted ?? 0,
      })

      // The webhook sends the pack receipt only when it is the one that granted the credits:
      // when this call won, the receipt is sent from here instead.
      const email = outcome.email
      if (checkoutSession.mode === 'payment' && email) {
        after(() => sendInvoiceEmail(email, {
          invoiceNumber: `INV-${Date.now()}`,
          date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
          description: `Pack crédits — ${outcome.creditsGranted ?? 0} crédits`,
          amountEur: checkoutSession.amount_total ? `${(checkoutSession.amount_total / 100).toFixed(2).replace('.', ',')} €` : '—',
        }))
      }

      if (secondsSinceCheckout > WEBHOOK_GRACE_SECONDS) {
        // After the response: the customer must not wait on an alert email, and a failed alert
        // must never fail a fulfilment that already succeeded.
        after(() => sendWebhookFallbackAlert({
          customerEmail: session.user?.email ?? null,
          sessionId,
          mode: checkoutSession.mode ?? 'unknown',
          secondsSinceCheckout,
          creditsGranted: outcome.creditsGranted ?? 0,
        }).catch(err => console.error('[billing/fulfill] alert failed:', err)))
      }
    }

    if (outcome.status === 'skipped') {
      console.warn('[billing/fulfill] nothing to fulfil:', outcome.reason)
    }

    // The page re-renders from this, so the customer sees their new plan and credits straight
    // away rather than a stale "FREE / 0 credits" behind a successful payment.
    const workspaceId = outcome.workspaceId ?? checkoutSession.metadata?.workspaceId
    const workspace = workspaceId
      ? await db.workspace.findUnique({
          where: { id: workspaceId },
          select: { plan: true, monthlyCredits: true, bonusCredits: true, subscriptionStatus: true, renewalDate: true },
        })
      : null

    await flushServerAnalytics()
    return NextResponse.json({
      status: outcome.status,
      workspaceId: workspaceId ?? null,
      plan: workspace?.plan ?? null,
      monthlyCredits: workspace?.monthlyCredits ?? 0,
      bonusCredits: workspace?.bonusCredits ?? 0,
      subscriptionStatus: workspace?.subscriptionStatus ?? null,
      renewalDate: workspace?.renewalDate ?? null,
    })
  } catch (err) {
    console.error('[billing/fulfill] error:', err)
    captureServerException(err, session.user.id)
    return NextResponse.json({ error: 'Fulfillment check failed' }, { status: 500 })
  }
}
