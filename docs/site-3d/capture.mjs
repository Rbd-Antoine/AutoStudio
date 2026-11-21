// Captures the home page's five chapters, from each chapter's camera stop, in a real browser.
//
//   node docs/site-3d/capture.mjs [baseUrl] [outDir] [--decors] [--mobile] [--reduced]
//
// Uses the Chrome installed on this machine (no browser download). Scrolls to each chapter's
// resting point (40 % into the section), waits for the camera's inertia to settle, captures.
// --decors also clicks each background in chapter 3. Prints console errors at the end.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const args = process.argv.slice(2)
const flags = new Set(args.filter(a => a.startsWith('--')))
const [base = 'http://localhost:3000', out = 'docs/site-3d/captures'] = args.filter(a => !a.startsWith('--'))
mkdirSync(out, { recursive: true })

const viewports = flags.has('--mobile')
  ? [{ name: '390', width: 390, height: 844, mobile: true }]
  : flags.has('--both')
    ? [{ name: '1440', width: 1440, height: 900 }, { name: '390', width: 390, height: 844, mobile: true }]
    : [{ name: '1440', width: 1440, height: 900 }]

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const errors = []
for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.mobile ? 2 : 1,
    isMobile: !!vp.mobile,
    hasTouch: !!vp.mobile,
    reducedMotion: flags.has('--reduced') ? 'reduce' : 'no-preference',
  })
  const page = await context.newPage()
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${vp.name}] ${m.text()}`) })
  page.on('pageerror', e => errors.push(`[${vp.name}] pageerror ${e.message}`))
  await page.goto(base, { waitUntil: 'networkidle', timeout: 120_000 })
  // The cookie banner is answered first, as a visitor would (it covers the bottom of the view).
  await page.getByRole('button', { name: /Tout refuser|Reject all/ }).click({ timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(2500)
  for (const id of ['avant', 'studio', 'fonds', 'tarifs', 'contact']) {
    const stop = id === 'studio' ? 0.82 : id === 'tarifs' || id === 'contact' ? 0.15 : 0.4
    await page.evaluate(([sel, f]) => {
      const el = document.getElementById(sel)
      if (!el) return
      const y = el.offsetTop + el.offsetHeight * f - window.innerHeight / 2
      window.scrollTo({ top: Math.max(0, y), behavior: 'instant' })
    }, [id, stop])
    await page.waitForTimeout(1800)
    await page.screenshot({ path: `${out}/${vp.name}-${id}.png` })
    if (id === 'fonds' && flags.has('--decors')) {
      for (const slug of ['hangar-industriel', 'parking-souterrain', 'piece-vide', 'garage-neon']) {
        const btn = page.locator(`button[role="radio"]:has(img[src*="${slug}"])`)
        await btn.click()
        await page.waitForTimeout(1400)
        await page.screenshot({ path: `${out}/${vp.name}-fonds-${slug}.png` })
      }
    }
  }
  await context.close()
}
await browser.close()
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors')
