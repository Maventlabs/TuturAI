import { chromium } from 'playwright'

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
const email = 'nina.wijaya@demo.example.test'
const password = 'DemoStudent2026!'

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run this script with Firebase Auth and Firestore emulators.')
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()

async function login() {
  await page.goto(`${baseURL}/auth/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Kata Sandi').fill(password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard' || url.pathname.includes('/siswa'), { timeout: 15_000 })
}

async function assertRoute(pathname, heading) {
  await page.goto(`${baseURL}${pathname}`)
  await page.getByRole('heading', { name: heading, exact: true }).waitFor()
  const body = await page.locator('main').innerText()
  if (/NaN|undefined|null XP|score: 0(?!\d)/i.test(body)) {
    throw new Error(`Unexpected placeholder data on ${pathname}: ${body}`)
  }
}

try {
  await login()

  const statsResponse = await page.request.get(`${baseURL}/api/student/learning-stats`)
  if (statsResponse.status() !== 200) throw new Error(`Expected learning stats 200, received ${statsResponse.status()}`)
  const stats = await statsResponse.json()
  if (!Array.isArray(stats.data?.achievements)) throw new Error('Learning stats did not return achievements')

  await assertRoute('/siswa/progress', 'Progress Belajar')
  await assertRoute('/siswa/leaderboard', 'Leaderboard')
  await assertRoute('/siswa/achievements', 'Pencapaian')
  await assertRoute('/siswa/profil', 'Profil & Pengaturan')

  await page.waitForFunction(() => document.querySelector('#profile-display-name')?.value === 'Nina Wijaya')
  await page.waitForFunction(() => document.querySelector('#profile-school')?.value === 'TuturAI Demo School')
  await page.getByLabel('Nama lengkap').fill('Nina Wijaya Updated')
  await page.getByLabel('Sekolah').fill('SMA E2E Updated')
  await page.getByRole('button', { name: 'Simpan profil', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Profil tersimpan di server.' }).waitFor()

  const profileResponse = await page.request.get(`${baseURL}/api/me`)
  if (profileResponse.status() !== 200) throw new Error(`Expected profile read-back 200, received ${profileResponse.status()}`)
  const profilePayload = await profileResponse.json()
  if (profilePayload.data?.profile?.full_name !== 'Nina Wijaya Updated' || profilePayload.data?.profile?.school !== 'SMA E2E Updated') {
    throw new Error(`Profile read-back did not contain the saved values: ${JSON.stringify(profilePayload)}`)
  }

  await page.reload()
  await page.waitForFunction(() => document.querySelector('#profile-display-name')?.value === 'Nina Wijaya Updated')
  await page.waitForFunction(() => document.querySelector('#profile-school')?.value === 'SMA E2E Updated')

  const unauthorizedContext = await browser.newContext()
  const unauthorizedResponse = await unauthorizedContext.request.get(`${baseURL}/api/student/learning-stats`)
  if (unauthorizedResponse.status() !== 401) throw new Error(`Expected unauthenticated learning stats 401, received ${unauthorizedResponse.status()}`)
  await unauthorizedContext.close()

  console.log(JSON.stringify({ ok: true, routes: ['progress', 'leaderboard', 'achievements', 'profile'], profileMutation: 'read-back-and-reload', achievements: stats.data.achievements.length, unauthorizedStatus: unauthorizedResponse.status() }))
} finally {
  await context.close()
  await browser.close()
}
