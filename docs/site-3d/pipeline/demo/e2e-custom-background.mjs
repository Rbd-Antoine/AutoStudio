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
const [car, background, logo, out] = process.argv.slice(2)
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
await page.locator('input[type=file][multiple]').setInputFiles(car)
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
const response = page.waitForResponse(r => r.url().includes('/api/background-swap'), { timeout: 300000 })
await page.getByRole('button', { name: /Générer mon rendu/ }).click()
const res = await response
const body = await res.json()
console.log(`4. réponse ${res.status()} en ${((Date.now() - started) / 1000).toFixed(0)} s`, body.error ?? '')
const result = body.results?.[0]
if (!result?.enhancedUrl) throw new Error('pas de rendu : ' + JSON.stringify(body).slice(0, 300))
await page.getByAltText('Véhicule généré').waitFor({ timeout: 60000 })
await page.screenshot({ path: `${out}/editor-after.png`, fullPage: true })
const url = result.enhancedUrl
const buf = url.startsWith('data:') ? Buffer.from(url.split(',')[1], 'base64') : Buffer.from(await (await fetch(url)).arrayBuffer())
fs.writeFileSync(`${out}/render.png`, buf)
console.log('5. rendu enregistré :', `${out}/render.png`)
console.log(errors.length ? 'erreurs page : ' + errors.join(' | ') : 'aucune erreur de page')
await browser.close()
