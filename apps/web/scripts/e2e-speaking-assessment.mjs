import { chromium } from 'playwright'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-tuturai'
const suffix = Date.now()
const teacherEmail = `e2e-teacher-${suffix}@example.test`
const teacherPassword = 'E2eTeacherPassword123!'
const teacherId = `e2e-teacher-${suffix}`
const classroomId = `e2e-classroom-${suffix}`
const assignmentId = `e2e-assignment-${suffix}`

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run this script with Firebase Auth and Firestore emulators. It will not seed production Firebase.')
}

const app = getApps()[0] ?? initializeApp({ projectId })
const auth = getAuth(app)
const db = getFirestore(app)
await auth.createUser({ uid: teacherId, email: teacherEmail, password: teacherPassword, displayName: 'E2E Teacher' })
const now = Timestamp.now()
await db.collection('users').doc(teacherId).set({ id: teacherId, email: teacherEmail, displayName: 'E2E Teacher', role: 'teacher', school: 'E2E', className: null, subject: 'English', xp: 0, level: 1, createdAt: now, updatedAt: now })
await db.collection('classrooms').doc(classroomId).set({ teacherId, name: 'E2E Speaking Class', status: 'active', description: 'Playwright fixture', createdAt: now, updatedAt: now })
await db.collection('assignments').doc(assignmentId).set({ classId: classroomId, title: 'Speaking assessment fixture', instructions: 'Speak about your day.', status: 'published', maxAttempts: 2, dueAt: null, createdAt: now, updatedAt: now })
await db.collection('submissions').doc(`${assignmentId}_e2e-student`).set({ assignmentId, studentId: 'e2e-student', attempt: 1, status: 'pending_review', isLate: false, teacherFeedback: null, submittedAt: now, updatedAt: now })
await db.collection('assessments').doc('e2e-student_session').set({ id: 'e2e-student_session', sessionId: 'session', studentId: 'e2e-student', mode: 'speaking', pronunciation: 82, fluency: 76, intonation: 80, grammar: 75, vocabulary: 88, overall: 80, transcript: 'I speak about my day.', feedback: 'Keep a steady pace.', confidence: 0.92, error: null, createdAt: new Date().toISOString() })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
try {
  await page.goto(`${baseURL}/auth/login`)
  await page.getByLabel('Email').fill(teacherEmail)
  await page.getByLabel('Kata Sandi').fill(teacherPassword)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL(/\/guru|\/dashboard/)
  await page.goto(`${baseURL}/guru/penilaian`)
  await page.getByRole('heading', { name: 'Speaking assessment fixture', exact: true }).waitFor()
  await page.getByText('AI score: 80/100').waitFor()
  console.log(JSON.stringify({ ok: true, page: '/guru/penilaian', score: 80 }))
} finally {
  await browser.close()
}
