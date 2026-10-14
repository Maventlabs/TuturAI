/**
 * Production PWA E2E: launch screen, service worker control, and offline.
 *
 * Run against a production build (`next build` then `next start`) or a deployed
 * origin. Fails closed: a missing controller, a splash that never clears, or an
 * offline navigation that crashes is a failure, not a warning.
 *
 *   node scripts/e2e-pwa-install.mjs                      # defaults to :3000
 *   E2E_PWA_BASE_URL=http://localhost:3000 node scripts/e2e-pwa-install.mjs
 */
import { chromium } from 'playwright'

const BASE = (process.env.E2E_PWA_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
const MOBILE = { width: 390, height: 844 }

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : ` -> ${detail}`}`)
}

async function run() {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    serviceWorkers: 'allow',
    viewport: MOBILE,
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  // --- manifest contract -----------------------------------------------------
  const manifestResponse = await page.request.get(`${BASE}/manifest.webmanifest`)
  check('manifest responds 200', manifestResponse.status() === 200, String(manifestResponse.status()))
  const manifest = await manifestResponse.json()
  check('manifest display is standalone', manifest.display === 'standalone', String(manifest.display))
  check(
    'manifest has no window-controls-overlay chrome',
    !JSON.stringify(manifest.display_override ?? []).includes('window-controls-overlay'),
    JSON.stringify(manifest.display_override),
  )
  check('manifest declares a maskable icon', (manifest.icons ?? []).some((i) => i.purpose === 'maskable'))

  // --- launch screen ---------------------------------------------------------
  // Throttle the bundle so the splash is genuinely observable rather than a
  // single-frame flash.
  await page.route('**/_next/static/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await route.continue()
  })
  await page.goto(BASE, { waitUntil: 'commit' })
  await page.waitForSelector('#boot-splash', { timeout: 10_000 }).catch(() => {})
  const splashBox = await page.locator('#boot-splash .bs-mark').boundingBox().catch(() => null)
  check('launch screen paints before hydration', Boolean(splashBox && splashBox.height >= 60), JSON.stringify(splashBox))
  const splashName = await page.locator('#boot-splash .bs-name').textContent().catch(() => '')
  check('launch screen shows the brand wordmark', Boolean(splashName?.includes('Tutur')), String(splashName))

  await page.waitForFunction(() => !document.getElementById('boot-splash'), null, { timeout: 30_000 }).catch(() => {})
  check('launch screen clears after hydration', (await page.locator('#boot-splash').count()) === 0)

  // --- service worker --------------------------------------------------------
  await page.waitForTimeout(4000)
  const sw = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    return {
      registered: Boolean(registration),
      active: Boolean(registration?.active),
      // PWABuilder and Chrome install both require a controller, which only
      // happens when the worker claims open clients.
      controller: Boolean(navigator.serviceWorker.controller),
    }
  })
  check('service worker registered', sw.registered)
  check('service worker active', sw.active)
  check('service worker controls the page', sw.controller, JSON.stringify(sw))

  const cached = await page.evaluate(async () => {
    const names = (await caches.keys()).filter((n) => n.startsWith('tuturai-static-'))
    if (names.length === 0) return []
    const cache = await caches.open(names[0])
    return (await cache.keys()).map((request) => new URL(request.url).pathname)
  })
  check('offline shell is precached', cached.includes('/offline.html'), JSON.stringify(cached))

  // --- offline ---------------------------------------------------------------
  await context.setOffline(true)
  const offline = await page.goto(BASE, { waitUntil: 'domcontentloaded' }).catch((e) => ({ err: e.message }))
  check('offline navigation still resolves', !offline?.err, offline?.err ?? '')
  const offlineTitle = await page.title().catch(() => '')
  check('offline shows the branded shell', offlineTitle.toLowerCase().includes('offline'), offlineTitle)

  const deep = await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' }).catch((e) => ({ err: e.message }))
  check('offline deep link does not crash', !deep?.err, deep?.err ?? '')

  await context.close()
  await browser.close()

  const failures = results.filter((r) => !r.ok).length
  console.log()
  if (failures) {
    console.log(`PWA E2E FAILED: ${failures} of ${results.length} checks`)
    process.exit(1)
  }
  console.log(`PWA E2E PASSED: ${results.length}/${results.length}`)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})