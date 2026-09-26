import { chromium } from 'playwright'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-tuturai'
const suffix = Date.now()
const password = 'E2eOnboardingPassword123!'
const fixtures = [
  { role: 'student', email: `e2e-onboarding-student-${suffix}@example.test`, name: `E2E Student ${suffix}`, extraLabel: 'Kelas', extra: 'XI-E2E', route: '/siswa', heading: 'Ayo lanjutkan latihan speaking-mu hari ini' },
  { role: 'teacher', email: `e2e-onboarding-teacher-${suffix}@example.test`, name: `E2E Teacher ${suffix}`, extraLabel: 'Mata Pelajaran', extra: 'English', route: '/guru', heading: 'Dashboard Guru' },
]

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run this script with Firebase Auth and Firestore emulators. It will not seed production Firebase.')
}

const app = getApps()[0] ?? initializeApp({ projectId })
const auth = getAuth(app)
const db = getFirestore(app)
const browser = await chromium.launch({ headless: true })
const fixtureEmails = fixtures.map((fixture) => fixture.email)

async function completeSignup(fixture) {
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.goto(`${baseURL}/auth/sign-up`)
    if (fixture.role === 'teacher') {
      await page.getByRole('button', { name: 'Guru', exact: true }).click()
    }
    await page.getByLabel('Nama Lengkap').fill(fixture.name)
    await page.getByLabel('Email').fill(fixture.email)
    await page.getByLabel('Asal Sekolah').fill('E2E School')
    await page.getByLabel(fixture.extraLabel).fill(fixture.extra)
    await page.getByLabel('Kata Sandi').fill(password)

    const onboardingPromise = page.waitForResponse((response) => (
      new URL(response.url()).pathname === '/api/auth/onboarding' && response.request().method() === 'POST'
    ))
    const sessionPromise = page.waitForResponse((response) => (
      new URL(response.url()).pathname === '/api/auth/session' && response.request().method() === 'POST'
    ))
    await page.getByRole('button', { name: 'Buat Akun', exact: true }).click()

    const [onboardingResponse, sessionResponse] = await Promise.all([onboardingPromise, sessionPromise])
    if (onboardingResponse.status() !== 201) throw new Error(`${fixture.role} onboarding returned ${onboardingResponse.status()}`)
    if (sessionResponse.status() !== 200) throw new Error(`${fixture.role} session creation returned ${sessionResponse.status()}`)
    await page.waitForURL((url) => url.pathname === fixture.route, { timeout: 15_000 })
    await page.getByRole('heading', { name: fixture.heading, exact: true }).waitFor()

    const user = await auth.getUserByEmail(fixture.email)
    const userDocument = await db.collection('users').doc(user.uid).get()
    const storedProfile = userDocument.data()
    if (!userDocument.exists || storedProfile?.role !== fixture.role || storedProfile?.displayName !== fixture.name || storedProfile?.school !== 'E2E School') {
      throw new Error(`${fixture.role} onboarding profile did not read back from Firestore`)
    }
    if (fixture.role === 'student' && storedProfile.className !== fixture.extra) {
      throw new Error('Student class selection did not persist during onboarding')
    }
    if (fixture.role === 'teacher' && storedProfile.subject !== fixture.extra) {
      throw new Error('Teacher subject selection did not persist during onboarding')
    }

    const profileResponse = await page.request.get(`${baseURL}/api/me`)
    if (profileResponse.status() !== 200) throw new Error(`${fixture.role} session did not authorize /api/me`)
    const profilePayload = await profileResponse.json()
    if (profilePayload.data?.profile?.id !== user.uid || profilePayload.data?.profile?.role !== fixture.role) {
      throw new Error(`${fixture.role} server profile did not read back for the new session`)
    }

    await page.reload()
    await page.waitForURL((url) => url.pathname === fixture.route, { timeout: 15_000 })
    await page.getByRole('heading', { name: fixture.heading, exact: true }).waitFor()
    return { role: fixture.role, onboardingStatus: onboardingResponse.status(), sessionStatus: sessionResponse.status(), firestoreReadback: true, reload: true }
  } finally {
    await context.close()
  }
}

try {
  const flows = []
  for (const fixture of fixtures) flows.push(await completeSignup(fixture))
  console.log(JSON.stringify({ ok: true, flows }))
} finally {
  for (const email of fixtureEmails) {
    try {
      const user = await auth.getUserByEmail(email)
      await db.collection('users').doc(user.uid).delete()
      await auth.deleteUser(user.uid)
    } catch (error) {
      if (error?.code !== 'auth/user-not-found') throw error
    }
  }
  await browser.close()
}
