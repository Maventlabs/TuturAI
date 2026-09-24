import { chromium } from 'playwright'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-tuturai'
const questionId = `e2e-pronunciation-${Date.now()}`

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run this script with Firebase Auth and Firestore emulators.')
}

const app = getApps()[0] ?? initializeApp({ projectId })
const db = getFirestore(app)
const now = Timestamp.now()
await db.collection('questionBank').doc(questionId).set({
  contentType: 'pronunciation',
  skill: 'pronunciation',
  level: 'intermediate',
  word: 'thorough',
  ipa: '/ˈθʌrə/',
  tip: 'Start with the unvoiced th sound.',
  prompt: 'Practice pronouncing thorough.',
  options: ['recorded'],
  correctOption: 0,
  explanation: 'Provider-unavailable attempts must remain unscored.',
  tags: ['pronunciation'],
  status: 'published',
  createdAt: now,
  updatedAt: now,
})

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()

try {
  await page.goto(`${baseURL}/auth/login`)
  await page.getByLabel('Email').fill('nina.wijaya@demo.example.test')
  await page.getByLabel('Kata Sandi').fill('DemoStudent2026!')
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL(/\/dashboard|\/siswa/)

  await page.goto(`${baseURL}/siswa/pronunciation?questionId=${encodeURIComponent(questionId)}`)
  await page.getByRole('heading', { name: 'Pronunciation Lab', exact: true }).waitFor()
  await page.getByRole('heading', { name: 'thorough', exact: true }).waitFor()

  const idempotencyKey = `e2e-pronunciation-${Date.now()}`
  const response = await page.request.post(`${baseURL}/api/student/practice-attempts`, {
    headers: { 'content-type': 'application/json', 'Idempotency-Key': idempotencyKey },
    data: { questionId, contentType: 'pronunciation', idempotencyKey },
  })
  if (![200, 201].includes(response.status())) throw new Error(`Expected provider-unavailable attempt success, received ${response.status()}`)
  const payload = await response.json()
  if (payload.data?.assessmentStatus !== 'provider_unavailable' || payload.data?.score !== null) {
    throw new Error(`Pronunciation returned an invalid score state: ${JSON.stringify(payload.data)}`)
  }

  console.log(JSON.stringify({ ok: true, route: '/siswa/pronunciation', assessmentStatus: payload.data.assessmentStatus, score: payload.data.score }))
} finally {
  await context.close()
  await browser.close()
}
