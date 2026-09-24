import { chromium } from 'playwright'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
const email = 'ava.pratama@demo.example.test'
const password = 'DemoTeacher2026!'
const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-tuturai'

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
  await page.waitForURL((url) => url.pathname === '/dashboard' || url.pathname.includes('/guru'), { timeout: 15_000 })
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

  const classrooms = await page.request.get(`${baseURL}/api/classrooms`)
  if (classrooms.status() !== 200) throw new Error(`Expected teacher classrooms 200, received ${classrooms.status()}`)
  const classroomPayload = await classrooms.json()
  const classroomId = classroomPayload.data?.[0]?.id
  if (!classroomId) throw new Error('Teacher fixture returned no classroom')

  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId }))
  await db.collection('classrooms').doc('e2e-outsider-classroom').set({
    name: 'Outsider classroom',
    teacherId: 'e2e-outsider-teacher',
    status: 'active',
    joinKeyHash: 'not-used',
    joinKeyRevoked: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
  const unauthorizedClassroom = await page.request.get(`${baseURL}/api/classrooms/e2e-outsider-classroom/members`)
  if (![403, 404].includes(unauthorizedClassroom.status())) {
    throw new Error(`Expected wrong-class members to fail closed with 403 or 404, received ${unauthorizedClassroom.status()}`)
  }

  await assertRoute('/guru', 'Dashboard Guru')
  await assertRoute('/guru/kelas', 'Kelas Saya')
  await assertRoute('/guru/penugasan', 'Penugasan')
  await assertRoute('/guru/siswa', 'Daftar Siswa')
  await assertRoute('/guru/penilaian', 'Penilaian Speaking')
  await assertRoute('/guru/analitik', 'Analitik Mendalam')
  await assertRoute('/guru/leaderboard', 'Papan Peringkat')

  const dashboardResponse = await page.request.get(`${baseURL}/api/teacher/analytics?classroomId=${encodeURIComponent(classroomId)}&period=7d`)
  if (dashboardResponse.status() !== 200) throw new Error(`Expected teacher analytics 200, received ${dashboardResponse.status()}`)

  console.log(JSON.stringify({ ok: true, classroomId, routes: ['dashboard', 'classes', 'assignments', 'students', 'speaking-review', 'analytics', 'leaderboard'], wrongClassStatus: unauthorizedClassroom.status() }))
} finally {
  await context.close()
  await browser.close()
}
