// Which element is the Largest Contentful Paint on a throttled phone (4x CPU, slow 4G).
import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await context.newPage()
const cdp = await context.newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 })
await page.addInitScript(() => {
  window.__lcp = []
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) window.__lcp.push({ t: Math.round(e.startTime), size: e.size, el: e.element ? (e.element.tagName + ' ' + (e.element.getAttribute('src') || e.element.textContent || '').slice(0, 60)) : '?', url: e.url })
  }).observe({ type: 'largest-contentful-paint', buffered: true })
})
const url = process.argv.find(a => a.startsWith('http')) || 'http://localhost:3000/'
if (process.argv.includes('--returning')) {
  // A returning visitor: the cookie banner was already answered on a first visit.
  await page.goto(url, { waitUntil: 'load' })
  await page.getByRole('button', { name: /Tout refuser|Reject all/ }).click({ timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(500)
}
await page.goto(url, { waitUntil: 'load' })
await page.waitForTimeout(6000)
console.log(JSON.stringify(await page.evaluate(() => window.__lcp), null, 1))
await browser.close()
