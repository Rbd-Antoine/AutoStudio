// Offline checks of the photo check that runs before any credit is taken (photo-check.server.ts):
// it refuses only on a clear "no vehicle", and lets every unanswered or odd reading through.
// Gemini is replaced by a fake fetch: no network, no cost. Usage: npm run check:photo-check
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { checkVehiclePhoto } from '../src/lib/photo-check.server'

let failed = 0
async function check(name: string, fn: () => void | Promise<void>) {
  try { await fn(); console.log(`✓ ${name}`) } catch (err) { failed++; console.log(`✗ ${name}\n  ${err instanceof Error ? err.stack : err}`) }
}

const answer = (json: unknown) => async () =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: typeof json === 'string' ? json : JSON.stringify(json) }] } }] }), { status: 200 })

async function main() {
  const photo = (await sharp({ create: { width: 2000, height: 1500, channels: 3, background: '#888' } }).jpeg().toBuffer()).toString('base64')
  const realFetch = globalThis.fetch
  let sentWidth = 0

  await check('a clear "no vehicle" refuses, with words for the dealer', async () => {
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      const img = Buffer.from(body.contents[0].parts[1].inline_data.data, 'base64')
      sentWidth = (await sharp(img).metadata()).width ?? 0
      return answer({ vehicle_present: false, is_photograph: true })()
    }) as typeof fetch
    const r = await checkVehiclePhoto('key', photo)
    assert.equal(r.ok, false)
    assert.ok(!r.ok && /aucun crédit/.test(r.message))
    assert.equal(sentWidth, 768, 'the photo is downscaled before being sent')
  })

  await check('a vehicle present lets the render go ahead, checked', async () => {
    globalThis.fetch = answer({ vehicle_present: true, is_photograph: true }) as typeof fetch
    assert.deepEqual(await checkVehiclePhoto('key', photo), { ok: true, checked: true })
  })

  for (const [label, fake] of [
    ['an HTTP error', async () => new Response('overloaded', { status: 503 })],
    ['a network failure', async () => { throw new TypeError('fetch failed') }],
    ['unparsable text', answer('not json')],
    ['a shape without the answer', answer({ something: 1 })],
  ] as const) {
    await check(`${label} lets the render go ahead, unchecked`, async () => {
      globalThis.fetch = fake as typeof fetch
      assert.deepEqual(await checkVehiclePhoto('key', photo), { ok: true, checked: false })
    })
  }

  await check('an image this server cannot read is let through', async () => {
    globalThis.fetch = (async () => { throw new Error('must not be called') }) as typeof fetch
    assert.deepEqual(await checkVehiclePhoto('key', Buffer.from('not an image').toString('base64')), { ok: true, checked: false })
  })

  globalThis.fetch = realFetch
  if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
  console.log('\nphoto check: all checks passed')
}
main()
