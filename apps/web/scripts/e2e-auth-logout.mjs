import { chromium } from 'playwright'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-tuturai'
const studentEmail = 'sec006.offline.logout@example.test'
const studentPassword = 'Sec006OfflineLogout2026!'
const studentId = 'sec006-offline-logout-student'

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run this script with Firebase Auth and Firestore emulators; it must not touch production accounts.')
}

const adminApp = getApps()[0] ?? initializeApp({ projectId })
const auth = getAuth(adminApp)
const db = getFirestore(adminApp)
let student
try {
  student = await auth.getUserByEmail(studentEmail)
} catch (error) {
  if (error?.code !== 'auth/user-not-found') throw error
  student = await auth.createUser({ uid: studentId, email: studentEmail, password: studentPassword, displayName: 'SEC-006 Logout Student' })
}
await auth.updateUser(student.uid, { email: studentEmail, password: studentPassword, displayName: 'SEC-006 Logout Student' })
await db.collection('users').doc(student.uid).set({
  id: student.uid,
  email: studentEmail,
  displayName: 'SEC-006 Logout Student',
  role: 'student',
  school: 'E2E',
  className: null,
  subject: null,
  xp: 0,
  level: 1,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
}, { merge: true })

const browser = await chromium.launch()
const context = await browser.newContext()
const page = await context.newPage()
const sessionEvents = []

page.on('response', async (response) => {
  const request = response.request()
  if (new URL(response.url()).pathname === '/api/auth/session' && request.method() === 'POST') {
    const headers = await response.headersArray()
    const setCookies = headers.filter((header) => header.name.toLowerCase() === 'set-cookie')
    sessionEvents.push({ status: response.status(), setCookieNames: setCookies.map((header) => header.value.split('=')[0]) })
  }
})

try {
  await page.goto(`${baseURL}/auth/login`)
  await page.getByLabel('Email').fill(studentEmail)
  await page.getByLabel('Kata Sandi').fill(studentPassword)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard' || url.pathname.startsWith('/siswa'))
  const routeAfterLogin = new URL(page.url()).pathname
  await page.goto(`${baseURL}/siswa`)
  const initialSession = await page.evaluate(async () => {
    const response = await fetch('/api/me', { cache: 'no-store' })
    const body = await response.json()
    return { status: response.status, errorCode: body.error?.code }
  })
  if (initialSession.status !== 200) {
    throw new Error(`Student session was not established before offline logout: ${JSON.stringify({ initialSession, routeAfterLogin, routeAfterNavigation: new URL(page.url()).pathname, sessionEvents })}`)
  }
  const sessionDeleteResponses = []
  page.on('requestfailed', (request) => {
    if (new URL(request.url()).pathname === '/api/auth/session' && request.method() === 'DELETE') {
      sessionDeleteResponses.push({ result: 'failed', reason: request.failure()?.errorText })
    }
  })
  page.on('response', (response) => {
    const request = response.request()
    if (new URL(response.url()).pathname === '/api/auth/session' && request.method() === 'DELETE') {
      sessionDeleteResponses.push({ result: 'response', status: response.status() })
    }
  })

  await page.context().setOffline(true)
  await page.getByRole('button', { name: 'Menu profil' }).click()
  await page.getByRole('menuitem', { name: 'Keluar' }).click()
  await page.waitForTimeout(500)
  await page.context().setOffline(false)

  const routeAfterFailedLogout = new URL(page.url()).pathname
  const sessionAfterFailedLogout = await page.request.get(`${baseURL}/api/me`)
  if (routeAfterFailedLogout !== '/siswa' || sessionAfterFailedLogout.status() !== 200) {
    throw new Error(`Offline logout boundary evidence: ${JSON.stringify({ routeAfterFailedLogout, status: sessionAfterFailedLogout.status(), sessionDeleteResponses })}`)
  }
  if (!sessionDeleteResponses.some((event) => event.result === 'failed')) {
    throw new Error(`Offline logout did not produce a failed session-delete request: ${JSON.stringify(sessionDeleteResponses)}`)
  }

  const logoutError = page.getByRole('alert').filter({ hasText: 'Keluar tidak berhasil.' })
  await logoutError.waitFor({ timeout: 2_000 })

  await page.getByRole('button', { name: 'Menu profil' }).click()
  await page.getByRole('menuitem', { name: 'Keluar' }).click()
  await page.waitForURL(`${baseURL}/auth/login`)
  const sessionAfterLogout = await page.request.get(`${baseURL}/api/me`)
  if (sessionAfterLogout.status() !== 401) {
    throw new Error(`Online logout left the server session active: ${sessionAfterLogout.status()}`)
  }

  console.log(JSON.stringify({ ok: true, offlineLogoutShowsError: true, onlineRetryClearsSession: true }))
} finally {
  await context.setOffline(false).catch(() => {})
  await context.close()
  await browser.close()
}
