import { chromium } from 'playwright'

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
const browser = await chromium.launch()
const context = await browser.newContext()
const page = await context.newPage()

try {
  await page.goto(`${baseURL}/auth/login`)
  await page.evaluate(async () => navigator.serviceWorker.ready)
  await page.reload()
  await page.evaluate(async () => navigator.serviceWorker.ready)
  await context.setOffline(true)
  await page.reload()
  await page.getByRole('heading', { name: 'TuturAI sedang offline', exact: true }).waitFor()
  console.log(JSON.stringify({ ok: true, offlineRefresh: true, shell: 'offline.html' }))
} finally {
  await context.close()
  await browser.close()
}
