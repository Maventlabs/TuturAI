import { chromium } from 'playwright'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-tuturai'
const suffix = Date.now()
const studentId = `e2e-speaking-provider-${suffix}`
const email = `${studentId}@example.test`
const password = 'E2eSpeakingProvider123!'
const sessionId = `provider-session-${suffix}`
const questionId = `provider-speaking-${suffix}`

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run this script with Firebase Auth and Firestore emulators. It will not seed production Firebase.')
}

function wavSilence() {
  const sampleRate = 16_000
  const samples = sampleRate
  const dataSize = samples * 2
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  return buffer
}

const app = getApps()[0] ?? initializeApp({ projectId })
const auth = getAuth(app)
const db = getFirestore(app)
const now = Timestamp.now()
await auth.createUser({ uid: studentId, email, password, displayName: 'E2E Speaking Provider Student' })
await db.collection('users').doc(studentId).set({ id: studentId, email, displayName: 'E2E Speaking Provider Student', role: 'student', xp: 0, level: 1, createdAt: now, updatedAt: now })
await db.collection('questionBank').doc(questionId).set({ id: questionId, contentType: 'speaking', skill: 'speaking', level: 'beginner', prompt: 'Say hello.', options: [], explanation: '', tags: ['e2e'], status: 'published', createdAt: now, updatedAt: now })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
try {
  await page.goto(`${baseURL}/auth/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Kata Sandi').fill(password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL(/\/siswa|\/dashboard/)

  const response = await page.request.post(`${baseURL}/api/student/assessment`, {
    multipart: {
      sessionId,
      questionId,
      mode: 'speaking',
      expectedText: 'Say hello.',
      audio: { name: 'speaking-provider.wav', mimeType: 'audio/wav', buffer: wavSilence() },
    },
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(`Speaking provider returned ${response.status()}: ${JSON.stringify(payload)}`)
  const assessment = payload.data
  if (!assessment || typeof assessment.overall !== 'number' || assessment.error !== null) throw new Error(`Speaking response was not a completed normalized assessment: ${JSON.stringify(assessment)}`)
  const stored = await db.collection('assessments').doc(assessment.id).get()
  if (!stored.exists || stored.data()?.overall !== assessment.overall) throw new Error('Confirmed speaking assessment was not durably persisted')
  console.log(JSON.stringify({ ok: true, transcript: assessment.transcript, overall: assessment.overall, assessmentId: assessment.id }))
} finally {
  await browser.close()
}
