import { createHash } from 'node:crypto'
import { chromium } from 'playwright'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-tuturai'
const suffix = Date.now()
const teacherId = `e2e-classroom-teacher-${suffix}`
const studentId = `e2e-classroom-student-${suffix}`
const classroomName = `E2E Join Class ${suffix}`
const teacherEmail = `${teacherId}@example.test`
const studentEmail = `${studentId}@example.test`
const password = 'E2eClassroomJoinPassword123!'

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run this script with Firebase Auth and Firestore emulators. It will not seed production Firebase.')
}

const app = getApps()[0] ?? initializeApp({ projectId })
const auth = getAuth(app)
const db = getFirestore(app)
const now = Timestamp.now()

await Promise.all([
  auth.createUser({ uid: teacherId, email: teacherEmail, password, displayName: 'E2E Classroom Teacher' }),
  auth.createUser({ uid: studentId, email: studentEmail, password, displayName: 'E2E Classroom Student' }),
])

await Promise.all([
  db.collection('users').doc(teacherId).set({ id: teacherId, email: teacherEmail, displayName: 'E2E Classroom Teacher', role: 'teacher', school: 'E2E', className: null, subject: 'English', xp: 0, level: 1, createdAt: now, updatedAt: now }),
  db.collection('users').doc(studentId).set({ id: studentId, email: studentEmail, displayName: 'E2E Classroom Student', role: 'student', school: 'E2E', className: null, subject: null, xp: 0, level: 1, createdAt: now, updatedAt: now }),
])

async function login(page, email, expectedRolePath) {
  await page.goto(`${baseURL}/auth/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Kata Sandi').fill(password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard' || url.pathname.startsWith(expectedRolePath), { timeout: 15_000 })
}

const browser = await chromium.launch({ headless: true })
const teacherContext = await browser.newContext()
const studentContext = await browser.newContext()
const teacherPage = await teacherContext.newPage()
const studentPage = await studentContext.newPage()

try {
  await login(teacherPage, teacherEmail, '/guru')
  await teacherPage.goto(`${baseURL}/guru/kelas`)
  await teacherPage.getByRole('heading', { name: 'Buat classroom', exact: true }).waitFor()
  await teacherPage.getByLabel('Nama kelas').fill(classroomName)
  await teacherPage.getByLabel('Sekolah (opsional)').fill('E2E School')
  await teacherPage.getByLabel('Deskripsi (opsional)').fill('Classroom membership durable E2E.')

  const createResponsePromise = teacherPage.waitForResponse((response) => (
    new URL(response.url()).pathname === '/api/classrooms' && response.request().method() === 'POST'
  ))
  await teacherPage.getByRole('button', { name: 'Buat kelas', exact: true }).click()
  const createResponse = await createResponsePromise
  if (createResponse.status() !== 201) throw new Error(`Classroom create returned ${createResponse.status()}`)
  const createdPayload = await createResponse.json()
  const classroomId = createdPayload.data?.id
  const joinKey = createdPayload.data?.joinKey
  if (typeof classroomId !== 'string' || typeof joinKey !== 'string' || !/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(joinKey)) {
    throw new Error('Classroom create did not return a valid classroom ID and join key')
  }
  await teacherPage.getByText(`Kode join untuk ${classroomName}`, { exact: true }).waitFor()
  const shownJoinKey = (await teacherPage.locator('code').innerText()).trim()
  if (shownJoinKey !== joinKey) throw new Error('Teacher UI did not display the join key returned by the API')

  const classroomSnapshot = await db.collection('classrooms').doc(classroomId).get()
  const classroomData = classroomSnapshot.data()
  const joinKeyHash = createHash('sha256').update(joinKey).digest('hex')
  if (!classroomSnapshot.exists || classroomData?.teacherId !== teacherId || classroomData.joinKeyHash !== joinKeyHash || 'joinKey' in classroomData) {
    throw new Error('Teacher-created classroom did not persist with an owner and hashed join key')
  }
  const reservation = await db.collection('classroomJoinKeys').doc(joinKeyHash).get()
  if (!reservation.exists || reservation.data()?.classroomId !== classroomId) {
    throw new Error('Join-key reservation was not independently persisted')
  }

  await login(studentPage, studentEmail, '/siswa')
  await studentPage.goto(`${baseURL}/siswa`)
  await studentPage.getByRole('heading', { name: 'Ayo lanjutkan latihan speaking-mu hari ini', exact: true }).waitFor()
  await studentPage.getByLabel('Kode join classroom').fill(joinKey)
  const joinResponsePromise = studentPage.waitForResponse((response) => (
    new URL(response.url()).pathname === '/api/classrooms/join' && response.request().method() === 'POST'
  ))
  await studentPage.getByRole('button', { name: 'Gabung', exact: true }).click()
  const joinResponse = await joinResponsePromise
  if (joinResponse.status() !== 201) throw new Error(`Student join returned ${joinResponse.status()}`)
  await studentPage.getByRole('status').filter({ hasText: `Berhasil bergabung ke ${classroomName}` }).waitFor()

  const membershipId = `${classroomId}_${studentId}`
  const membership = await db.collection('classMemberships').doc(membershipId).get()
  if (!membership.exists || membership.data()?.classId !== classroomId || membership.data()?.studentId !== studentId || membership.data()?.status !== 'active') {
    throw new Error('Student membership did not persist independently in Firestore')
  }

  await studentPage.reload()
  await studentPage.getByText(classroomName, { exact: true }).first().waitFor()
  const activeClassroom = studentPage.getByLabel('Pilih classroom aktif')
  if (await activeClassroom.inputValue() !== classroomId) {
    throw new Error('Active classroom selection did not survive student page reload')
  }
  const teacherMemberResponse = await teacherPage.request.get(`${baseURL}/api/classrooms/${classroomId}/members`)
  if (teacherMemberResponse.status() !== 200) throw new Error(`Teacher member read-back returned ${teacherMemberResponse.status()}`)
  const teacherMembers = await teacherMemberResponse.json()
  if (!teacherMembers.data?.some((member) => member.studentId === studentId)) {
    throw new Error('Teacher member API did not read back the joined student')
  }
  await teacherPage.goto(`${baseURL}/guru/siswa`)
  await teacherPage.getByRole('heading', { name: 'Daftar Siswa', exact: true }).waitFor()
  await teacherPage.getByText('E2E Classroom Student', { exact: true }).first().waitFor()

  console.log(JSON.stringify({ ok: true, flow: 'teacher-create-student-join-teacher-readback', classroomPersisted: true, membershipPersisted: true, teacherReadback: true }))
} finally {
  await teacherContext.close()
  await studentContext.close()
  await browser.close()
}
