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

try {
  await page.goto(`${baseURL}/auth/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Kata Sandi').fill(password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard' || url.pathname.includes('/guru'), { timeout: 15_000 })

  const classroomsResponse = await page.request.get(`${baseURL}/api/classrooms`)
  if (classroomsResponse.status() !== 200) throw new Error(`Expected classrooms 200, received ${classroomsResponse.status()}`)
  const classroomsPayload = await classroomsResponse.json()
  const classroomId = classroomsPayload.data?.[0]?.id
  if (!classroomId) throw new Error('Teacher fixture returned no classroom')

  const title = `E2E authored assignment ${Date.now()}`
  await page.goto(`${baseURL}/guru/penugasan`)
  await page.getByRole('heading', { name: 'Penugasan', exact: true }).waitFor()
  await page.getByLabel('Classroom').selectOption(classroomId)
  await page.getByLabel('Status saat dibuat').selectOption('published')
  await page.getByLabel('Judul').fill(title)
  await page.getByLabel('Instruksi').fill('Create and read back a durable assignment.')
  await page.getByLabel('Maksimal attempt').fill('2')

  const createResponse = page.waitForResponse((response) => response.url().includes(`/api/classrooms/${classroomId}/assignments`) && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Simpan penugasan', exact: true }).click()
  const created = await createResponse
  if (created.status() !== 201) throw new Error(`Expected assignment create 201, received ${created.status()}`)

  const assignmentsResponse = await page.request.get(`${baseURL}/api/classrooms/${classroomId}/assignments`)
  if (assignmentsResponse.status() !== 200) throw new Error(`Expected assignment read-back 200, received ${assignmentsResponse.status()}`)
  const assignmentsPayload = await assignmentsResponse.json()
  const assignment = assignmentsPayload.data?.find((item) => item.title === title)
  if (!assignment || assignment.status !== 'published' || assignment.maxAttempts !== 2) {
    throw new Error(`Assignment read-back did not match durable create: ${JSON.stringify(assignment)}`)
  }

  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId }))
  const persisted = await db.collection('assignments').doc(assignment.id).get()
  if (!persisted.exists || persisted.data().classId !== classroomId || persisted.data().title !== title || persisted.data().status !== 'published' || persisted.data().maxAttempts !== 2) {
    throw new Error('Firestore assignment does not match the browser-created assignment')
  }
  await page.reload()
  await page.getByRole('heading', { name: title, exact: true }).waitFor()
  await db.collection('classrooms').doc('e2e-outsider-classroom').set({
    name: 'Outsider classroom',
    teacherId: 'e2e-outsider-teacher',
    status: 'active',
    joinKeyHash: 'not-used',
    joinKeyRevoked: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
  const outsiderResponse = await page.request.post(`${baseURL}/api/classrooms/e2e-outsider-classroom/assignments`, {
    data: { title: 'Should fail', instructions: 'Wrong owner', status: 'published', maxAttempts: 1 },
  })
  if (![403, 404].includes(outsiderResponse.status())) {
    throw new Error(`Expected wrong-class authoring to fail closed with 403 or 404, received ${outsiderResponse.status()}`)
  }

  console.log(JSON.stringify({ ok: true, assignmentId: assignment.id, status: assignment.status, readBack: true, firestoreConfirmed: true, reloadConfirmed: true, wrongClassStatus: outsiderResponse.status() }))
} finally {
  await context.close()
  await browser.close()
}
