// Offline checks of the vehicle-protection client (src/lib/vehicle-protection.server.ts) against a
// fake provider on localhost: when it steps aside, what it sends, and that any failure keeps the
// render as drawn. No GPU, no network, no cost. Usage: npm run check:vehicle-protection
// The provider's own composition is tested in Python: python -m pytest services/vehicle-protection/tests -q
import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import sharp from 'sharp'
import { protectVehicle, requestTargetsVehicle, protectionTimeout } from '../src/lib/vehicle-protection.server'

let failed = 0
async function check(name: string, fn: () => void | Promise<void>) {
  try { await fn(); console.log(`✓ ${name}`) } catch (err) { failed++; console.log(`✗ ${name}\n  ${err instanceof Error ? err.stack : err}`) }
}

const png = (w: number, h: number, colour: string) =>
  sharp({ create: { width: w, height: h, channels: 3, background: colour } }).png().toBuffer()

type Reply = { status: number; body: unknown }
let reply: (body: { imageBase64: string; generatedImageBase64: string }) => Promise<Reply>
let lastAuth = ''

async function main() {
  const server = http.createServer((req, res) => {
    let raw = ''
    req.on('data', chunk => { raw += chunk })
    req.on('end', async () => {
      lastAuth = req.headers.authorization ?? ''
      const { status, body } = await reply(JSON.parse(raw))
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port

  const photo = await png(1600, 1200, '#b03030')
  const render = { data: await png(1200, 900, '#e0e0e0'), mimeType: 'image/png' }
  const restored = await png(1200, 900, '#b03030')

  await check('requests that change the car switch protection off, scene requests do not', () => {
    for (const text of ['Masquer la plaque', 'flouter l’immatriculation', 'Jantes noires', 'hide the license plate', 'repeindre en bleu'])
      assert.equal(requestTargetsVehicle(text), true, text)
    for (const text of ['', 'Fond plus lumineux', 'ambiance coucher de soleil', 'sol mouillé, ciel dégagé'])
      assert.equal(requestTargetsVehicle(text), false, text)
  })

  await check('the time left decides the call: at most 90 s, skipped under 15 s', () => {
    assert.equal(protectionTimeout(200_000), 90_000)
    assert.equal(protectionTimeout(40_000), 40_000)
    assert.equal(protectionTimeout(10_000), null)
  })

  await check('not configured: the render as drawn, said so', async () => {
    delete process.env.VEHICLE_PROTECTION_URL
    const r = await protectVehicle(photo, render, { remainingMs: 100_000 })
    assert.equal(r.protected, false)
    assert.equal(r.skipped, 'not_configured')
    assert.equal(r.image, render.data)
  })

  process.env.VEHICLE_PROTECTION_URL = `http://127.0.0.1:${port}/segment`
  process.env.VEHICLE_PROTECTION_TOKEN = 'secret-token'

  await check('a valid answer replaces the render, with the token sent and the diagnostics kept', async () => {
    reply = async body => {
      assert.ok(body.imageBase64 && body.generatedImageBase64)
      return { status: 200, body: { version: 2, imageBase64: restored.toString('base64'), diagnostics: { vehicleCoverage: 0.31 } } }
    }
    const r = await protectVehicle(photo, render, { remainingMs: 100_000 })
    assert.equal(lastAuth, 'Bearer secret-token')
    assert.equal(r.protected, true)
    assert.ok(r.image.equals(restored))
    assert.deepEqual(r.diagnostics, { vehicleCoverage: 0.31 })
  })

  await check('a request on the car itself never reaches the provider', async () => {
    reply = async () => { throw new Error('provider called') }
    const r = await protectVehicle(photo, render, { requests: 'masquer la plaque', remainingMs: 100_000 })
    assert.equal(r.skipped, 'request_targets_vehicle')
  })

  await check('a reframed render (photo 4:3, render 16:9) is not protected', async () => {
    const wide = { data: await png(1600, 900, '#e0e0e0'), mimeType: 'image/png' }
    const r = await protectVehicle(photo, wide, { remainingMs: 100_000 })
    assert.equal(r.skipped, 'framing')
  })

  await check('the provider refusing a moved car is recorded as framing, the render kept', async () => {
    reply = async () => ({ status: 422, body: { detail: "The render's viewpoint changed; source pixels not restored" } })
    const r = await protectVehicle(photo, render, { remainingMs: 100_000 })
    assert.equal(r.protected, false)
    assert.equal(r.skipped, 'framing')
    assert.equal(r.image, render.data)
  })

  await check('a result of another size is refused (it would shift the whole picture)', async () => {
    const other = await png(1000, 750, '#b03030')
    reply = async () => ({ status: 200, body: { version: 2, imageBase64: other.toString('base64') } })
    const r = await protectVehicle(photo, render, { remainingMs: 100_000 })
    assert.equal(r.skipped, 'invalid_result')
  })

  await check('a provider down keeps the render', async () => {
    process.env.VEHICLE_PROTECTION_URL = 'http://127.0.0.1:1/segment'
    const r = await protectVehicle(photo, render, { remainingMs: 100_000 })
    assert.equal(r.skipped, 'provider')
    assert.equal(r.image, render.data)
  })

  server.close()
  if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
  console.log('\nvehicle protection: all checks passed')
}
main()
