import { chromium } from 'playwright'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-tuturai'
const email = 'nina.wijaya@demo.example.test'
const password = 'DemoStudent2026!'
const classroomId = 'demo-classroom-english-01'

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run this script with Firebase Auth and Firestore emulators.')
}

const db = getFirestore(getApps()[0] ?? initializeApp({ projectId }))
await db.collection('classrooms').doc('e2e-student-voice-outsider').set({
  name: 'Voice outsider classroom',
  teacherId: 'e2e-outsider-teacher',
  status: 'active',
  joinKeyHash: 'not-used',
  joinKeyRevoked: false,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
})

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

try {
  await page.goto(`${baseURL}/auth/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Kata Sandi').fill(password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL(/\/siswa|\/dashboard/)

  const invalid = await page.request.post(`${baseURL}/api/classrooms/${classroomId}/voice`, {
    data: { text: '' },
  })
  if (invalid.status() !== 400) throw new Error(`Expected invalid voice text 400, received ${invalid.status()}`)

  const processing = await page.request.post(`${baseURL}/api/classrooms/${classroomId}/voice`, {
    data: { text: 'Practice sentence.' },
  })
  if (processing.status() !== 409) throw new Error(`Expected teacher voice processing gate 409, received ${processing.status()}`)
  const processingPayload = await processing.json()
  if (processingPayload.error?.details?.status !== 'processing') {
    throw new Error(`Expected explicit processing status, received ${JSON.stringify(processingPayload)}`)
  }

  const outsider = await page.request.post(`${baseURL}/api/classrooms/e2e-student-voice-outsider/voice`, {
    data: { text: 'Should not cross classroom boundary.' },
  })
  if (![403, 404].includes(outsider.status())) {
    throw new Error(`Expected wrong-class voice request to fail closed with 403 or 404, received ${outsider.status()}`)
  }

  console.log(JSON.stringify({
    ok: true,
    invalidStatus: invalid.status(),
    providerGateStatus: processing.status(),
    providerGate: processingPayload.error.details.status,
    wrongClassStatus: outsider.status(),
  }))
} finally {
  await browser.close()
}
