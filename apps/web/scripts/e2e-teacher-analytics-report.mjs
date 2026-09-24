import { chromium } from 'playwright'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-tuturai'
const suffix = Date.now()
const teacherId = `e2e-analytics-teacher-${suffix}`
const studentId = `e2e-analytics-student-${suffix}`
const outsiderTeacherId = `e2e-analytics-outsider-${suffix}`
const classroomId = `e2e-analytics-classroom-${suffix}`
const teacherEmail = `${teacherId}@example.test`
const studentEmail = `${studentId}@example.test`
const outsiderEmail = `${outsiderTeacherId}@example.test`
const password = 'E2eAnalyticsPassword123!'

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run this script with Firebase Auth and Firestore emulators. It will not seed production Firebase.')
}

const app = getApps()[0] ?? initializeApp({ projectId })
const auth = getAuth(app)
const db = getFirestore(app)
const now = Timestamp.now()

await Promise.all([
  auth.createUser({ uid: teacherId, email: teacherEmail, password, displayName: 'E2E Analytics Teacher' }),
  auth.createUser({ uid: studentId, email: studentEmail, password, displayName: 'E2E Analytics Student' }),
  auth.createUser({ uid: outsiderTeacherId, email: outsiderEmail, password, displayName: 'E2E Outsider Teacher' }),
])

await Promise.all([
  db.collection('users').doc(teacherId).set({ id: teacherId, email: teacherEmail, displayName: 'E2E Analytics Teacher', role: 'teacher', xp: 0, level: 1, createdAt: now, updatedAt: now }),
  db.collection('users').doc(studentId).set({ id: studentId, email: studentEmail, displayName: 'E2E Analytics Student', role: 'student', xp: 120, level: 2, createdAt: now, updatedAt: now }),
  db.collection('users').doc(outsiderTeacherId).set({ id: outsiderTeacherId, email: outsiderEmail, displayName: 'E2E Outsider Teacher', role: 'teacher', xp: 0, level: 1, createdAt: now, updatedAt: now }),
  db.collection('classrooms').doc(classroomId).set({ id: classroomId, teacherId, name: 'E2E Analytics Class', status: 'active', createdAt: now, updatedAt: now }),
  db.collection('classMemberships').doc(`${classroomId}_${studentId}`).set({ classId: classroomId, studentId, status: 'active', joinedAt: now }),
  db.collection('questionAttempts').doc(`${studentId}_analytics-attempt`).set({ id: `${studentId}_analytics-attempt`, studentId, questionId: 'q-analytics', classroomId, skill: 'grammar', isCorrect: true, createdAt: now }),
  db.collection('assessments').doc(`${studentId}_analytics-session`).set({ id: `${studentId}_analytics-session`, sessionId: 'analytics-session', studentId, questionId: 'speaking-analytics', mode: 'speaking', pronunciation: 82, fluency: 76, intonation: 80, grammar: 75, vocabulary: 88, overall: 80, transcript: 'I practiced English today.', feedback: 'Keep a steady pace.', confidence: 0.92, error: null, createdAt: new Date().toISOString() }),
])

async function login(page, email) {
  await page.goto(`${baseURL}/auth/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Kata Sandi').fill(password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL(/\/guru|\/dashboard/)
}

const browser = await chromium.launch({ headless: true })
const teacherContext = await browser.newContext()
const outsiderContext = await browser.newContext()
const teacherPage = await teacherContext.newPage()
const outsiderPage = await outsiderContext.newPage()

try {
  await login(teacherPage, teacherEmail)
  await teacherPage.goto(`${baseURL}/guru/analitik`)
  await teacherPage.getByText('E2E Analytics Class', { exact: true }).waitFor()
  await teacherPage.getByText('Total Siswa').waitFor()
  await teacherPage.getByText('80%').waitFor()

  const analyticsResponse = teacherPage.waitForResponse((response) => response.url().includes('/api/teacher/analytics?period=7d'))
  await teacherPage.getByLabel('Periode analitik').selectOption('7d')
  if ((await (await analyticsResponse).status()) !== 200) throw new Error('Analytics period filter failed')

  const reportResponse = teacherPage.waitForResponse((response) => response.url().includes('/api/teacher/reports?period=7d'))
  await teacherPage.getByRole('button', { name: 'Unduh PDF' }).click()
  const report = await reportResponse
  if (report.status() !== 200 || !report.headers()['content-type']?.includes('application/pdf')) throw new Error('PDF report response was not a PDF')

  await login(outsiderPage, outsiderEmail)
  const unauthorized = await outsiderPage.request.get(`${baseURL}/api/teacher/reports?studentId=${studentId}&period=all`)
  if (unauthorized.status() !== 403) throw new Error(`Unexpected outsider report status: ${unauthorized.status()}`)

  console.log(JSON.stringify({ ok: true, analytics: 200, period: 200, reportContentType: report.headers()['content-type'], outsiderReportStatus: unauthorized.status() }))
} finally {
  await teacherContext.close()
  await outsiderContext.close()
  await browser.close()
}
