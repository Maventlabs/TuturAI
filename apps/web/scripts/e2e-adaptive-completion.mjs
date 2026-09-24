import { chromium } from 'playwright'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-tuturai'
const suffix = Date.now()
const studentId = `e2e-adaptive-student-${suffix}`
const email = `${studentId}@example.test`
const password = 'E2eAdaptivePassword123!'
const questionId = `e2e-adaptive-vocabulary-${suffix}`

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run this script with Firebase Auth and Firestore emulators. It will not seed production Firebase.')
}

const app = getApps()[0] ?? initializeApp({ projectId })
const auth = getAuth(app)
const db = getFirestore(app)
const now = Timestamp.now()

await auth.createUser({ uid: studentId, email, password, displayName: 'E2E Adaptive Student' })
await db.collection('users').doc(studentId).set({
  id: studentId,
  email,
  displayName: 'E2E Adaptive Student',
  role: 'student',
  school: 'E2E',
  className: null,
  subject: null,
  xp: 0,
  level: 1,
  createdAt: now,
  updatedAt: now,
})

const existingQuestions = await db.collection('questionBank').get()
const cleanup = db.batch()
existingQuestions.docs.forEach((doc) => cleanup.delete(doc.ref))
cleanup.set(db.collection('questionBank').doc(questionId), {
  contentType: 'vocabulary',
  skill: 'vocabulary',
  level: 'beginner',
  word: 'adaptive',
  meaning: 'mampu menyesuaikan diri',
  example: 'An adaptive learner changes strategy when needed.',
  ipa: '/əˈdæptɪv/',
  tip: 'Connect the word to the learning path.',
  prompt: 'Review the word adaptive.',
  options: ['mastered'],
  correctOption: 0,
  explanation: 'The card is mastered after the protected answer is confirmed.',
  tags: ['e2e', 'adaptive'],
  status: 'published',
  createdAt: now,
  updatedAt: now,
})
await cleanup.commit()

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()
const browserErrors = []
page.on('console', (message) => {
  if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`)
})
page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`))

try {
  await page.goto(`${baseURL}/auth/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Kata Sandi').fill(password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard' || url.pathname.includes('/siswa'), { timeout: 15_000 })

  const adaptiveResponse = page.waitForResponse((response) => response.url().includes('/api/student/adaptive') && response.status() === 200)
  await page.goto(`${baseURL}/siswa/adaptive`)
  await page.getByRole('heading', { name: 'Adaptive Learning Path', exact: true }).waitFor()
  await adaptiveResponse
  const recommendationLink = page.locator('a[href*="questionId="]').first()
  if (await recommendationLink.count() === 0) {
    throw new Error(`Adaptive recommendation missing. Main content: ${await page.locator('main').innerText()}`)
  }
  const recommendationHref = await recommendationLink.getAttribute('href')
  if (recommendationHref !== `/siswa/vocabulary?questionId=${encodeURIComponent(questionId)}`) {
    throw new Error(`Adaptive recommendation did not target the expected activity: ${recommendationHref}`)
  }

  await recommendationLink.click()
  await page.getByRole('heading', { name: 'Vocabulary', exact: true }).waitFor()
  await page.getByText('Memuat bank kosakata...').waitFor({ state: 'detached', timeout: 30_000 })
  await page.getByRole('button', { name: 'Sudah hafal', exact: true }).click()
  await page.getByRole('dialog').getByText('Aktivitas selesai').waitFor()
  await page.getByRole('dialog').getByText('1/1').waitFor()

  const refreshedAdaptiveResponse = page.waitForResponse((response) => response.url().includes('/api/student/adaptive') && response.status() === 200)
  await page.goto(`${baseURL}/siswa/adaptive`)
  await refreshedAdaptiveResponse
  await page.getByText('1 / 1').waitFor()
  if (await page.getByText('Rekomendasi berikutnya', { exact: true }).count()) {
    throw new Error('Adaptive path still exposes a recommendation after the only activity was completed')
  }

  const attempts = await db.collection('questionAttempts').where('studentId', '==', studentId).get()
  const matchingAttempts = attempts.docs.filter((doc) => doc.data().questionId === questionId)
  if (matchingAttempts.length !== 1 || matchingAttempts[0].data().isCorrect !== true) {
    throw new Error(`Expected exactly one confirmed adaptive attempt, received ${matchingAttempts.length}`)
  }
  if (browserErrors.length > 0) throw new Error(`Browser errors detected: ${browserErrors.join(' | ')}`)

  console.log(JSON.stringify({ ok: true, recommendation: questionId, durableAttempts: matchingAttempts.length, completedCount: '1 / 1' }))
} finally {
  await context.close()
  await browser.close()
}
