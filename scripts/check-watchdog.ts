// Offline checks that a render request always ends (watchdog.ts), that the Gemini helpers pick
// the right frame and the right words for a failure, and that a stale render's refund is computed
// from the ledger. No network, no database, no cost. Usage: npm run check:watchdog
import assert from 'node:assert/strict'
import { endWithin } from '../src/lib/watchdog'
import { describeRenderFailure, GeminiBlockedError, GeminiUnavailableError, nearestAspectRatio } from '../src/lib/gemini'
import { unsettledSpend } from '../src/lib/stale-generations'

let failed = 0
async function check(name: string, fn: () => void | Promise<void>) {
  try { await fn(); console.log(`✓ ${name}`) } catch (err) { failed++; console.log(`✗ ${name}\n  ${err instanceof Error ? err.stack : err}`) }
}
const later = <T,>(value: T, ms: number) => new Promise<T>(resolve => setTimeout(() => resolve(value), ms))

async function main() {
  await check('watchdog: work that ends in time answers itself', async () => {
    const run = { finishing: false, abandoned: false }
    assert.deepEqual(await endWithin(later('render', 10), 200, run), { ended: true, value: 'render' })
    assert.equal(run.abandoned, false)
  })

  await check('watchdog: work that does not end is given up — marked abandoned, its late failure swallowed', async () => {
    const run = { finishing: false, abandoned: false }
    const work = new Promise<string>((_, reject) => setTimeout(() => reject(new Error('abandoned by the watchdog')), 120))
    assert.deepEqual(await endWithin(work, 40, run), { ended: false })
    assert.equal(run.abandoned, true)
    await later(null, 150) // the late rejection must not surface as an unhandled one
  })

  await check('watchdog: a render being stored when the limit comes is left to end', async () => {
    const run = { finishing: true, abandoned: false }
    assert.deepEqual(await endWithin(later('stored', 120), 40, run), { ended: true, value: 'stored' })
    assert.equal(run.abandoned, false)
  })

  await check("watchdog: an error before the limit is the work's own", async () => {
    await assert.rejects(endWithin(Promise.reject(new Error('boom')), 200, { finishing: false, abandoned: false }), /boom/)
  })

  await check('aspect ratio: a phone photo keeps its frame, not the background reference\'s', () => {
    assert.equal(nearestAspectRatio(4032, 3024), '4:3')
    assert.equal(nearestAspectRatio(3024, 4032), '3:4')
    assert.equal(nearestAspectRatio(1920, 1080), '16:9')
    assert.equal(nearestAspectRatio(1000, 1000), '1:1')
    assert.equal(nearestAspectRatio(0, 1000), undefined)
  })

  await check('failures: refusal 422, overload 503, timeout 504, anything else 500 — each with words', () => {
    const blocked = describeRenderFailure(new GeminiBlockedError('IMAGE_RECITATION', 'déjà publiée'))
    assert.deepEqual([blocked.status, blocked.reason, blocked.message], [422, 'refused', 'déjà publiée'])
    assert.equal(describeRenderFailure(new GeminiUnavailableError(503, 'busy')).status, 503)
    const timeout = Object.assign(new Error('aborted'), { name: 'TimeoutError' })
    assert.equal(describeRenderFailure(timeout).reason, 'timeout')
    assert.equal(describeRenderFailure(new Error('db down')).status, 500)
  })

  await check('stale render: what was spent and never given back, per bucket', () => {
    assert.deepEqual(unsettledSpend([{ delta: -1, bucket: 'monthly', reason: 'ENHANCEMENT' }]), { monthlySpent: 1, bonusSpent: 0 })
    assert.deepEqual(unsettledSpend([
      { delta: -1, bucket: 'monthly', reason: 'ENHANCEMENT' },
      { delta: -2, bucket: 'bonus', reason: 'ENHANCEMENT' },
      { delta: 1, bucket: 'monthly', reason: 'REFUND' },
    ]), { monthlySpent: 0, bonusSpent: 2 })
    // Already refunded by the route: nothing more.
    assert.deepEqual(unsettledSpend([
      { delta: -1, bucket: 'bonus', reason: 'ENHANCEMENT' },
      { delta: 1, bucket: 'bonus', reason: 'REFUND' },
    ]), { monthlySpent: 0, bonusSpent: 0 })
  })

  if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
  console.log('\nwatchdog: all checks passed')
}
main()
