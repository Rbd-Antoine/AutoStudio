// End-to-end check of "your own background + your logo" in the real editor, against the local
// dev server (DEV_AUTH_BYPASS signs in as the local admin; one real Gemini render, about 0.05 EUR).
//
//   node docs/site-3d/pipeline/demo/e2e-custom-background.mjs <car photo> <background photo> <logo> <outDir>
//
// Steps: upload the logo in the brand kit, then in the editor import the car photo, import the
// background photo as "Votre propre fond", switch the logo on (bottom right), generate, and save
// the render the editor shows. Fails loudly at the first step that does not happen.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(path.resolve('package.json'))
const { chromium } = require('playwright')
const [car, background, logo, out, car2] = process.argv.slice(2)
fs.mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', e => errors.push(String(e).slice(0, 300)))

// 1. Brand kit: the logo.
await page.goto('http://localhost:3000/app/brand-kit', { waitUntil: 'networkidle', timeout: 120000 })
// The consent banner covers the bottom of the page: answer it first.
const refuse = page.getByRole('button', { name: /Refuser|Tout refuser/i }).first()
if (await refuse.isVisible().catch(() => false)) await refuse.click()
await page.locator('input[type=file]').first().setInputFiles(logo)
await page.getByRole('button', { name: /Enregistrer/ }).click()
await page.waitForResponse(r => r.url().includes('/api/brand-kit') && r.request().method() !== 'GET', { timeout: 60000 })
console.log('1. logo enregistré dans le kit de marque')

// 2. Editor: car photo, own background, logo on.
await page.goto('http://localhost:3000/app/editor', { waitUntil: 'networkidle', timeout: 120000 })
await page.locator('input[type=file][multiple]').setInputFiles(car2 ? [car, car2] : car)
const bgInput = page.locator('input[type=file]:not([multiple])')
await bgInput.setInputFiles(background)
await page.getByRole('button', { name: /Votre propre fond/ }).waitFor()
console.log('2. photo du véhicule et fond personnalisé importés, choisi :', await page.getByRole('button', { name: /Votre propre fond/ }).getAttribute('aria-pressed'))
const toggle = page.getByRole('switch', { name: /logo/ })
await toggle.waitFor({ timeout: 30000 })
if ((await toggle.getAttribute('aria-checked')) !== 'true') await toggle.click()
await page.getByRole('button', { name: 'En bas à droite' }).click()
console.log('3. logo activé, en bas à droite')
await page.screenshot({ path: `${out}/editor-before.png`, fullPage: true })

// 3. Generate and wait for the render.
const started = Date.now()
// One request per photo, sent in parallel by the editor: wait for all of them.
const expected = car2 ? 2 : 1
const responses = []
page.on('response', r => { if (r.url().includes('/api/background-swap')) responses.push(r) })
await page.getByRole('button', { name: /Générer (mon rendu|mes \d+ rendus)/ }).click()
while (responses.length < expected && Date.now() - started < 300000) await page.waitForTimeout(500)
const bodies = await Promise.all(responses.map(r => r.json()))
console.log(`4. ${responses.length} réponse(s) ${responses.map(r => r.status()).join(', ')} en ${((Date.now() - started) / 1000).toFixed(0)} s`)
const results = bodies.map(b => b.results?.[0]).filter(Boolean)
for (const b of bodies) if (!b.results?.[0]?.enhancedUrl) console.log('   échec :', JSON.stringify(b).slice(0, 300))
const result = results.find(r => r.enhancedUrl)
if (!result) throw new Error('pas de rendu')
await page.getByAltText('Véhicule généré').waitFor({ timeout: 60000 })
await page.screenshot({ path: `${out}/editor-after.png`, fullPage: true })
for (const [i, r] of results.entries()) {
  if (!r.enhancedUrl) continue
  const url = r.enhancedUrl
  const buf = url.startsWith('data:') ? Buffer.from(url.split(',')[1], 'base64') : Buffer.from(await (await fetch(url)).arrayBuffer())
  fs.writeFileSync(`${out}/render-${i + 1}.png`, buf)
  console.log(`5. rendu ${i + 1} enregistré : ${out}/render-${i + 1}.png (${(r.processingMs / 1000).toFixed(0)} s)`)
}
console.log(errors.length ? 'erreurs page : ' + errors.join(' | ') : 'aucune erreur de page')
await browser.close()
