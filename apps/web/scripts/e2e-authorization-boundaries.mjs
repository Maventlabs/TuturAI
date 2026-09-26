import { createHash } from 'node:crypto'
import { chromium } from 'playwright'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-tuturai'
const suffix = Date.now()
const teacherId = `e2e-authz-teacher-${suffix}`
const studentId = `e2e-authz-student-${suffix}`
const teacherEmail = `${teacherId}@example.test`
const studentEmail = `${studentId}@example.test`
const teacherName = `E2E Authz Teacher ${suffix}`
const studentName = `E2E Authz Student ${suffix}`
const password = 'E2eAuthorizationPassword123!'
const revokedJoinKey = 'ABCDEFG2'
const revokedClassroomId = `e2e-authz-revoked-${suffix}`
const assignmentClassroomId = `e2e-authz-assignment-class-${suffix}`
const assignmentId = `e2e-authz-attempt-limit-${suffix}`
const assignmentTitle = `E2E Attempt Limit ${suffix}`
const assignmentSubmissionId = `${assignmentId}_${studentId}`
const now = Timestamp.now()

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run this script with Firebase Auth and Firestore emulators. It will not seed production Firebase.')
}

const app = getApps()[0] ?? initializeApp({ projectId })
const auth = getAuth(app)
const db = getFirestore(app)
const createdUserIds = []
let browser
let teacherContext
let studentContext
let anonymousContext

async function createFixtureUser({ id, email, displayName, role }) {
  await auth.createUser({ uid: id, email, password, displayName })
  createdUserIds.push(id)
  await db.collection('users').doc(id).set({
    id,
    email,
    displayName,
    role,
    school: 'E2E',
    className: null,
    subject: role === 'teacher' ? 'English' : null,
    xp: 0,
    level: 1,
    createdAt: now,
    updatedAt: now,
  })
}

async function login(page, email, rolePath) {
  await page.goto(`${baseURL}/auth/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Kata Sandi').fill(password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard' || url.pathname.startsWith(rolePath), { timeout: 15_000 })
}

async function assertNoMembership(classroomId, student) {
  const snapshot = await db.collection('classMemberships').doc(`${classroomId}_${student}`).get()
  if (snapshot.exists) throw new Error(`Rejected join unexpectedly created membership for ${classroomId}`)
}

try {
  await createFixtureUser({ id: teacherId, email: teacherEmail, displayName: teacherName, role: 'teacher' })
  await createFixtureUser({ id: studentId, email: studentEmail, displayName: studentName, role: 'student' })

  await Promise.all([
    db.collection('classrooms').doc(revokedClassroomId).set({
      id: revokedClassroomId,
      name: `Revoked key class ${suffix}`,
      teacherId,
      status: 'active',
      joinKeyHash: createHash('sha256').update(revokedJoinKey).digest('hex'),
      joinKeyRevoked: true,
      createdAt: now,
      updatedAt: now,
    }),
    db.collection('classrooms').doc(assignmentClassroomId).set({
      id: assignmentClassroomId,
      name: `Attempt limit class ${suffix}`,
      teacherId,
      status: 'active',
      joinKeyHash: createHash('sha256').update(`ATTEMPT${suffix.toString().slice(-1)}`).digest('hex'),
      joinKeyRevoked: false,
      createdAt: now,
      updatedAt: now,
    }),
    db.collection('classMemberships').doc(`${assignmentClassroomId}_${studentId}`).set({
      classId: assignmentClassroomId,
      studentId,
      status: 'active',
      joinedAt: now,
    }),
    db.collection('assignments').doc(assignmentId).set({
      id: assignmentId,
      classId: assignmentClassroomId,
      title: assignmentTitle,
      instructions: 'Submit once, then confirm a second attempt is rejected after return.',
      status: 'published',
      maxAttempts: 1,
      dueAt: null,
      createdAt: now,
      updatedAt: now,
    }),
  ])

  browser = await chromium.launch({ headless: true })
  teacherContext = await browser.newContext()
  studentContext = await browser.newContext()
  anonymousContext = await browser.newContext()
  const teacherPage = await teacherContext.newPage()
  const studentPage = await studentContext.newPage()

  const anonymousJoin = await anonymousContext.request.post(`${baseURL}/api/classrooms/join`, { data: { joinKey: revokedJoinKey } })
  if (anonymousJoin.status() !== 401) throw new Error(`Unauthenticated classroom join returned ${anonymousJoin.status()}`)

  await login(teacherPage, teacherEmail, '/guru')
  const teacherJoin = await teacherPage.request.post(`${baseURL}/api/classrooms/join`, { data: { joinKey: revokedJoinKey } })
  if (teacherJoin.status() !== 403) throw new Error(`Teacher attempting student join returned ${teacherJoin.status()}`)
  await assertNoMembership(revokedClassroomId, teacherId)

  await login(studentPage, studentEmail, '/siswa')
  await studentPage.goto(`${baseURL}/siswa`)
  await studentPage.getByLabel('Kode join classroom').fill('abc')
  const invalidResponsePromise = studentPage.waitForResponse((response) => new URL(response.url()).pathname === '/api/classrooms/join')
  await studentPage.getByRole('button', { name: 'Gabung', exact: true }).click()
  const invalidResponse = await invalidResponsePromise
  if (invalidResponse.status() !== 400) throw new Error(`Malformed join key returned ${invalidResponse.status()}`)
  await assertNoMembership(revokedClassroomId, studentId)

  await studentPage.getByLabel('Kode join classroom').fill('ZZZZZZZZ')
  const unknownResponsePromise = studentPage.waitForResponse((response) => new URL(response.url()).pathname === '/api/classrooms/join')
  await studentPage.getByRole('button', { name: 'Gabung', exact: true }).click()
  const unknownResponse = await unknownResponsePromise
  if (unknownResponse.status() !== 404) throw new Error(`Unknown join key returned ${unknownResponse.status()}`)
  await assertNoMembership(revokedClassroomId, studentId)

  await studentPage.getByLabel('Kode join classroom').fill(revokedJoinKey)
  const revokedResponsePromise = studentPage.waitForResponse((response) => new URL(response.url()).pathname === '/api/classrooms/join')
  await studentPage.getByRole('button', { name: 'Gabung', exact: true }).click()
  const revokedResponse = await revokedResponsePromise
  if (revokedResponse.status() !== 409) throw new Error(`Revoked join key returned ${revokedResponse.status()}`)
  await assertNoMembership(revokedClassroomId, studentId)

  await studentPage.goto(`${baseURL}/siswa/penugasan`)
  const assignmentHeading = studentPage.getByRole('heading', { name: assignmentTitle, exact: true })
  await assignmentHeading.waitFor()
  const assignmentCard = assignmentHeading.locator('xpath=../..')
  const firstSubmitPromise = studentPage.waitForResponse((response) => (
    new URL(response.url()).pathname === `/api/assignments/${assignmentId}/submit` && response.request().method() === 'POST'
  ))
  await assignmentCard.getByRole('button', { name: 'Kumpulkan', exact: true }).click()
  const firstSubmit = await firstSubmitPromise
  if (firstSubmit.status() !== 201) throw new Error(`First assignment attempt returned ${firstSubmit.status()}`)
  await studentPage.getByText('Status: pending_review · Attempt 1').waitFor()

  await teacherPage.goto(`${baseURL}/guru/penilaian`)
  await teacherPage.getByRole('heading', { name: assignmentTitle, exact: true }).waitFor()
  await teacherPage.getByRole('button', { name: 'Kembalikan', exact: true }).click()
  await teacherPage.getByRole('alert').filter({ hasText: 'Feedback wajib' }).waitFor()
  await teacherPage.getByLabel('Umpan Balik Guru').fill('No attempts remain for this assignment.')
  const returnPromise = teacherPage.waitForResponse((response) => (
    new URL(response.url()).pathname === `/api/submissions/${assignmentSubmissionId}/return` && response.request().method() === 'POST'
  ))
  await teacherPage.getByRole('button', { name: 'Kembalikan', exact: true }).click()
  const returnResponse = await returnPromise
  if (returnResponse.status() !== 200) throw new Error(`Teacher return returned ${returnResponse.status()}`)

  await studentPage.reload()
  const returnedCard = studentPage.getByRole('heading', { name: assignmentTitle, exact: true }).locator('xpath=../..')
  await studentPage.getByText('Status: returned · Attempt 1').waitFor()
  const exhaustedButton = returnedCard.getByRole('button', { name: 'Tidak ada attempt tersisa', exact: true })
  await exhaustedButton.waitFor()
  if (!await exhaustedButton.isDisabled()) {
    throw new Error('Student UI must disable resubmission after maxAttempts was exhausted')
  }

  const rejectedAttempt = await studentPage.request.post(`${baseURL}/api/assignments/${assignmentId}/submit`, {
    headers: { 'Idempotency-Key': `attempt-two-${suffix}` },
    data: {},
  })
  if (rejectedAttempt.status() !== 409) throw new Error(`Attempt beyond maxAttempts returned ${rejectedAttempt.status()}`)
  const persistedSubmission = await db.collection('submissions').doc(assignmentSubmissionId).get()
  if (!persistedSubmission.exists || persistedSubmission.data()?.attempt !== 1 || persistedSubmission.data()?.status !== 'returned') {
    throw new Error('Rejected attempt changed the persisted submission state')
  }

  console.log(JSON.stringify({
    ok: true,
    unauthenticatedJoinStatus: anonymousJoin.status(),
    wrongRoleJoinStatus: teacherJoin.status(),
    malformedJoinStatus: invalidResponse.status(),
    unknownJoinStatus: unknownResponse.status(),
    revokedJoinStatus: revokedResponse.status(),
    overLimitAttemptStatus: rejectedAttempt.status(),
    persistedAttemptCount: persistedSubmission.data().attempt,
  }))
} finally {
  await Promise.all([teacherContext?.close(), studentContext?.close(), anonymousContext?.close()].filter(Boolean))
  if (browser) await browser.close()
  await Promise.all([
    db.collection('classMemberships').doc(`${assignmentClassroomId}_${studentId}`).delete(),
    db.collection('joinRateLimits').doc(studentId).delete(),
    db.collection('submissions').doc(assignmentSubmissionId).delete(),
    db.collection('assignments').doc(assignmentId).delete(),
    db.collection('classrooms').doc(revokedClassroomId).delete(),
    db.collection('classrooms').doc(assignmentClassroomId).delete(),
    db.collection('classroomJoinKeys').doc(createHash('sha256').update(revokedJoinKey).digest('hex')).delete(),
    db.collection('users').doc(teacherId).delete(),
    db.collection('users').doc(studentId).delete(),
  ])
  await Promise.all(createdUserIds.map(async (id) => {
    try {
      await auth.deleteUser(id)
    } catch (error) {
      if (error?.code !== 'auth/user-not-found') throw error
    }
  }))
}
