// Captures one chapter at several points of its own progress (camera, light and decor in motion).
//   node docs/site-3d/sequence.mjs <chapterId> <outDir> [width] [height] [fractions...]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const [id = 'studio', out = 'docs/site-3d/captures/seq', w = '1440', h = '900', ...fr] = process.argv.slice(2)
const fractions = fr.length ? fr.map(Number) : [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95]
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: +w, height: +h } })
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Tout refuser|Reject all/ }).click({ timeout: 5000 }).catch(() => {})
  // The Next.js development badge is not part of the page.
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
await page.waitForTimeout(2000)
for (const f of fractions) {
  await page.evaluate(([sel, k]) => {
    const el = document.getElementById(sel)
    window.scrollTo({ top: el.offsetTop + el.offsetHeight * k - window.innerHeight / 2, behavior: 'instant' })
  }, [id, f])
  await page.waitForTimeout(1600)
  await page.screenshot({ path: `${out}/${id}-${String(Math.round(f * 100)).padStart(2, '0')}.png` })
}
await browser.close()
