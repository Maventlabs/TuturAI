import { chromium } from 'playwright'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-tuturai'
const suffix = Date.now()
const teacherId = `e2e-assignment-teacher-${suffix}`
const studentId = `e2e-assignment-student-${suffix}`
const classroomId = `e2e-assignment-classroom-${suffix}`
const assignmentId = `e2e-assignment-${suffix}`
const teacherEmail = `${teacherId}@example.test`
const studentEmail = `${studentId}@example.test`
const password = 'E2eAssignmentPassword123!'

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run this script with Firebase Auth and Firestore emulators. It will not seed production Firebase.')
}

const app = getApps()[0] ?? initializeApp({ projectId })
const auth = getAuth(app)
const db = getFirestore(app)
const now = Timestamp.now()

await Promise.all([
  auth.createUser({ uid: teacherId, email: teacherEmail, password, displayName: 'E2E Assignment Teacher' }),
  auth.createUser({ uid: studentId, email: studentEmail, password, displayName: 'E2E Assignment Student' }),
])

await Promise.all([
  db.collection('users').doc(teacherId).set({ id: teacherId, email: teacherEmail, displayName: 'E2E Assignment Teacher', role: 'teacher', school: 'E2E', className: null, subject: 'English', xp: 0, level: 1, createdAt: now, updatedAt: now }),
  db.collection('users').doc(studentId).set({ id: studentId, email: studentEmail, displayName: 'E2E Assignment Student', role: 'student', school: 'E2E', className: null, subject: null, xp: 0, level: 1, createdAt: now, updatedAt: now }),
  db.collection('classrooms').doc(classroomId).set({ name: 'E2E Assignment Class', teacherId, status: 'active', description: 'Playwright fixture', school: 'E2E', joinKeyHash: 'a'.repeat(64), joinKeyRevoked: false, createdAt: now, updatedAt: now }),
  db.collection('classMemberships').doc(`${classroomId}_${studentId}`).set({ classId: classroomId, studentId, status: 'active', joinedAt: now }),
  db.collection('assignments').doc(assignmentId).set({ classId: classroomId, title: 'E2E Assignment Lifecycle', instructions: 'Submit the fileless speaking response.', status: 'published', maxAttempts: 2, dueAt: null, createdAt: now, updatedAt: now }),
])

async function login(page, email, expectedPath) {
  await page.goto(`${baseURL}/auth/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Kata Sandi').fill(password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard' || url.pathname.includes(expectedPath), { timeout: 15_000 })
}

const browser = await chromium.launch({ headless: true })
const studentContext = await browser.newContext()
const teacherContext = await browser.newContext()
const studentPage = await studentContext.newPage()
const teacherPage = await teacherContext.newPage()

try {
  await login(studentPage, studentEmail, '/siswa')
  await studentPage.goto(`${baseURL}/siswa/penugasan`)
   await studentPage.getByRole('heading', { name: 'E2E Assignment Lifecycle', exact: true }).waitFor()
   await studentPage.getByRole('heading', { name: 'E2E Assignment Lifecycle', exact: true }).locator('xpath=../..').getByRole('button', { name: 'Kumpulkan', exact: true }).click()
  await studentPage.getByText('Penugasan terkumpul').waitFor()
  await studentPage.getByText('Status: pending_review').waitFor()

  await login(teacherPage, teacherEmail, '/guru')
  await teacherPage.goto(`${baseURL}/guru/penilaian`)
   await teacherPage.getByRole('heading', { name: 'E2E Assignment Lifecycle', exact: true }).waitFor()
  await teacherPage.getByRole('button', { name: 'Kembalikan' }).click()
  await teacherPage.getByRole('alert').filter({ hasText: 'Feedback wajib' }).waitFor()
  await teacherPage.getByLabel('Umpan Balik Guru').fill('Please retry with a clearer response.')
  await teacherPage.getByRole('button', { name: 'Kembalikan' }).click()
  await teacherPage.getByText('Tidak ada submission menunggu').waitFor()

  await studentPage.reload()
  await studentPage.getByText('Status: returned').waitFor()
  await studentPage.getByRole('button', { name: 'Kirim ulang' }).click()
  await studentPage.getByText('Penugasan terkumpul').waitFor()
  await studentPage.getByText('Status: pending_review').waitFor()

  await teacherPage.reload()
   await teacherPage.getByRole('heading', { name: 'E2E Assignment Lifecycle', exact: true }).waitFor()
  await teacherPage.getByRole('button', { name: 'Setujui' }).click()
  await teacherPage.getByText('Tidak ada submission menunggu').waitFor()

  await studentPage.reload()
  await studentPage.getByText('Status: approved').waitFor()
  const submission = await db.collection('submissions').doc(`${assignmentId}_${studentId}`).get()
  const data = submission.data()
  if (data?.status !== 'approved' || data.attempt !== 2) throw new Error('Server state did not reach approved attempt 2')

  console.log(JSON.stringify({ ok: true, flow: 'submit-return-resubmit-approve', attempt: data.attempt, status: data.status }))
} finally {
  await studentContext.close()
  await teacherContext.close()
  await browser.close()
}
