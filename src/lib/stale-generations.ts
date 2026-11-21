import { db } from '@/lib/db'
import { refundCredits } from '@/lib/credits'

// Every generating route stops within its maxDuration (5 minutes) and marks its row ENHANCED or
// FAILED, refunding the credit itself on failure (watchdog.ts). A row still PROCESSING after 10
// minutes is one whose function was killed anyway (deploy, crash): it will never finish, and
// nothing gave its credit back. The routes link their debit to the photo as soon as the row
// exists, so the ledger says exactly what is still owed.
export const STALE_GENERATION_MS = 10 * 60 * 1000

const staleCutoff = () => new Date(Date.now() - STALE_GENERATION_MS)

interface LedgerRow {
  delta: number
  bucket: string | null
  reason: string
}

/** What a photo's debits took and its refunds have not given back, per bucket. Pure. */
export function unsettledSpend(rows: LedgerRow[]): { monthlySpent: number; bonusSpent: number } {
  let monthly = 0
  let bonus = 0
  for (const row of rows) {
    if (row.reason !== 'ENHANCEMENT' && row.reason !== 'REFUND') continue
    // A debit is negative, a refund positive: what is owed is minus their sum.
    if (row.bucket === 'bonus') bonus -= row.delta
    else monthly -= row.delta
  }
  return { monthlySpent: Math.max(0, monthly), bonusSpent: Math.max(0, bonus) }
}

/**
 * Marks the generations that can no longer finish as FAILED and refunds what they cost; all
 * workspaces when none is given. Each row is claimed by a conditional update, so two callers
 * (the cron and a page load) never refund the same render twice.
 */
export async function failStaleGenerations(workspaceId?: string): Promise<number> {
  const stale = await db.photo.findMany({
    where: { status: 'PROCESSING', createdAt: { lt: staleCutoff() }, ...(workspaceId ? { workspaceId } : {}) },
    select: { id: true, workspaceId: true },
    take: 200,
  })

  let count = 0
  for (const photo of stale) {
    const claimed = await db.photo.updateMany({
      where: { id: photo.id, status: 'PROCESSING' },
      data: { status: 'FAILED', errorMessage: 'Génération interrompue (délai dépassé).' },
    })
    if (claimed.count === 0) continue
    count++

    const rows = await db.creditTransaction.findMany({
      where: { photoId: photo.id },
      select: { delta: true, bucket: true, reason: true, featureKey: true },
    })
    const owed = unsettledSpend(rows)
    if (owed.monthlySpent + owed.bonusSpent > 0) {
      await refundCredits(photo.workspaceId, owed, {
        featureKey: rows.find(r => r.featureKey)?.featureKey ?? undefined,
        photoId: photo.id,
        notes: 'Automatic refund: generation interrupted',
      })
    }
  }
  return count
}

/** Whether a row is a generation actually running now: PROCESSING and recent. */
export function isActiveGeneration(p: { status: string; createdAt: Date }): boolean {
  return p.status === 'PROCESSING' && p.createdAt.getTime() >= staleCutoff().getTime()
}
