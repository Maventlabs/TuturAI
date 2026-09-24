import { chromium } from 'playwright'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-tuturai'
const suffix = Date.now()
const studentId = `e2e-learning-student-${suffix}`
const email = `${studentId}@example.test`
const password = 'E2eLearningPassword123!'

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run this script with Firebase Auth and Firestore emulators. It will not seed production Firebase.')
}

const app = getApps()[0] ?? initializeApp({ projectId })
const auth = getAuth(app)
const db = getFirestore(app)
const now = Timestamp.now()

await auth.createUser({ uid: studentId, email, password, displayName: 'E2E Learning Student' })
await db.collection('users').doc(studentId).set({
  id: studentId,
  email,
  displayName: 'E2E Learning Student',
  role: 'student',
  school: 'E2E',
  className: null,
  subject: null,
  xp: 0,
  level: 1,
  createdAt: now,
  updatedAt: now,
})

const oldFixtures = await db.collection('questionBank').get()
const cleanup = db.batch()
oldFixtures.docs
  .filter((doc) => doc.id.startsWith('e2e-'))
  .forEach((doc) => cleanup.delete(doc.ref))
await cleanup.commit()

const batch = db.batch()
for (let index = 0; index < 10; index += 1) {
  const suffixLabel = String(index + 1).padStart(3, '0')
  batch.set(db.collection('questionBank').doc(`e2e-grammar-${suffix}-${suffixLabel}`), {
    contentType: 'question',
    skill: 'grammar',
    level: 'beginner',
    prompt: `E2E grammar question ${index + 1}: choose the correct answer.`,
    options: ['correct', 'incorrect', 'maybe', 'unknown'],
    correctOption: 0,
    explanation: 'The first option is correct for this fixture.',
    tags: ['e2e', 'grammar'],
    status: 'published',
    createdAt: now,
    updatedAt: now,
  })
  batch.set(db.collection('questionBank').doc(`e2e-listening-${suffix}-${suffixLabel}`), {
    contentType: 'listening',
    skill: 'listening',
    level: 'beginner',
    prompt: `E2E listening question ${index + 1}: what did the speaker say?`,
    options: ['correct', 'incorrect', 'maybe', 'unknown'],
    correctOption: 0,
    explanation: 'The first option is correct for this fixture.',
    audioText: 'The correct answer is the first option.',
    tags: ['e2e', 'listening'],
    status: 'published',
    createdAt: now,
    updatedAt: now,
  })
  batch.set(db.collection('questionBank').doc(`e2e-test-${suffix}-${suffixLabel}`), {
    contentType: 'test',
    skill: 'grammar',
    level: 'beginner',
    word: `E2E test ${index + 1}`,
    prompt: `E2E pedagogical test question ${index + 1}.`,
    options: ['correct', 'incorrect', 'maybe', 'unknown'],
    correctOption: 0,
    explanation: 'The first option is correct for this fixture.',
    tags: ['e2e', 'test'],
    status: 'published',
    createdAt: now,
    updatedAt: now,
  })
  batch.set(db.collection('questionBank').doc(`e2e-conversation-${suffix}-${suffixLabel}`), {
    contentType: 'conversation',
    skill: 'conversation',
    level: 'beginner',
    prompt: `E2E conversation ${index + 1}: describe your daily learning routine.`,
    options: ['text'],
    correctOption: 0,
    explanation: 'Conversation answers are scored by the server-side text rubric.',
    tags: ['e2e', 'conversation'],
    status: 'published',
    createdAt: now,
    updatedAt: now,
  })
  batch.set(db.collection('questionBank').doc(`e2e-vocabulary-${suffix}-${suffixLabel}`), {
    contentType: 'vocabulary',
    skill: 'vocabulary',
    level: 'beginner',
    word: `E2E vocabulary ${index + 1}`,
    meaning: 'kata latihan E2E',
    example: `Use E2E vocabulary ${index + 1} in a sentence.`,
    ipa: `/e2e-${index + 1}/`,
    tip: 'Review the meaning, then confirm mastery.',
    prompt: `Review the word E2E vocabulary ${index + 1}.`,
    options: ['mastered'],
    correctOption: 0,
    explanation: 'Vocabulary mastery is persisted as a correct question attempt.',
    tags: ['e2e', 'vocabulary'],
    status: 'published',
    createdAt: now,
    updatedAt: now,
  })
}
await batch.commit()

async function login(page) {
  await page.goto(`${baseURL}/auth/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Kata Sandi').fill(password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard' || url.pathname.includes('/siswa'), { timeout: 15_000 })
}

async function answerSequentialQuestions(page) {
  let answered = 0
  while (answered < 50) {
    const prompt = page.locator('main h2').last()
    await prompt.waitFor()
    await prompt.locator('xpath=..').getByRole('button').first().click()
    answered += 1
    const finishButton = page.getByRole('button', { name: 'Lihat Hasil', exact: true })
    if (await finishButton.count()) {
      await finishButton.click()
      return answered
    }
    await page.getByRole('button', { name: 'Soal Berikutnya', exact: true }).click()
  }
  throw new Error('Question flow exceeded the E2E safety limit.')
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()

try {
  await login(page)

  await page.goto(`${baseURL}/siswa/quiz`)
  await page.getByRole('heading', { name: 'Quiz Harian', exact: true }).waitFor()
  const quizCount = await answerSequentialQuestions(page)
  await page.getByRole('dialog').getByText('Aktivitas selesai').waitFor()
  await page.getByRole('dialog').getByText('100/100').waitFor()
  await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click()

  await page.goto(`${baseURL}/siswa/listening`)
  await page.getByRole('heading', { name: 'Listening Comprehension', exact: true }).waitFor()
  await page.getByText('Memuat latihan listening...').waitFor({ state: 'detached', timeout: 30_000 })
  const correctOptions = page.getByRole('button', { name: 'correct', exact: true })
  const cardCount = await correctOptions.count()
  if (cardCount < 10) {
    const buttons = await page.locator('main button').allTextContents()
    const bodyText = await page.locator('main').innerText()
    throw new Error(`Expected 10 listening cards, received ${cardCount}; buttons=${JSON.stringify(buttons)}; body=${JSON.stringify(bodyText)}`)
  }
  for (let index = 0; index < cardCount; index += 1) {
    await correctOptions.nth(index).click()
  }
  const submitListening = page.getByRole('button', { name: 'Kumpulkan Jawaban', exact: true })
  if (await submitListening.isDisabled()) {
    const remaining = await page.locator('main button').evaluateAll((buttons) => buttons.filter((button) => (button.textContent ?? '').trim() === 'correct').length)
    throw new Error(`Listening answers did not all persist: cards=${cardCount}, remainingCorrectButtons=${remaining}`)
  }
  await submitListening.click()
  await page.getByRole('dialog').getByText('Aktivitas selesai').waitFor()
  await page.getByRole('dialog').getByText('100/100').waitFor()

  await page.goto(`${baseURL}/siswa/tes`)
  await page.getByRole('heading', { name: 'Tes Pedagogis', exact: true }).waitFor()
  await page.getByText('Bank soal tes sedang dimuat...').waitFor({ state: 'detached', timeout: 30_000 })
  const testCount = await answerSequentialQuestions(page)
  await page.getByRole('dialog').getByText('Aktivitas selesai').waitFor()
  await page.getByRole('dialog').getByText('100/100').waitFor()

  await page.goto(`${baseURL}/siswa/percakapan`)
  await page.getByRole('heading', { name: 'AI Conversation', exact: true }).waitFor()
  await page.getByText('Memuat skenario percakapan...').waitFor({ state: 'detached', timeout: 30_000 })
  await page.getByLabel('Jawaban percakapan').fill('I practice my daily learning routine every morning.')
  await page.getByRole('button', { name: 'Kirim', exact: true }).click()
  await page.getByRole('dialog').getByText('Hasil percakapan sudah dikonfirmasi tersimpan oleh server.').waitFor()
  await page.getByRole('dialog').getByText(/\/100/).waitFor()

  await page.goto(`${baseURL}/siswa/vocabulary`)
  await page.getByRole('heading', { name: 'Vocabulary', exact: true }).waitFor()
  await page.getByText('Memuat bank kosakata...').waitFor({ state: 'detached', timeout: 30_000 })
  const masteryButton = page.getByRole('button', { name: 'Sudah hafal', exact: true })
  for (let index = 0; index < 10; index += 1) {
    await masteryButton.click()
  }
  await page.getByRole('dialog').getByText('Semua kartu kosakata pada sesi ini sudah dikonfirmasi tersimpan.').waitFor()
  await page.getByRole('dialog').getByText('10/10').waitFor()

  const adaptiveResponse = page.waitForResponse((response) => response.url().includes('/api/student/adaptive') && response.status() === 200)
  await page.goto(`${baseURL}/siswa/adaptive`)
  await page.getByRole('heading', { name: 'Adaptive Learning Path', exact: true }).waitFor()
  await adaptiveResponse
  await page.getByText(/Materi selesai/).waitFor()
  const adaptiveLinks = page.locator('a[href*="questionId="]')
  if (await adaptiveLinks.count() === 0) throw new Error('Adaptive path did not expose a linked durable activity')

  const attempts = await db.collection('questionAttempts').where('studentId', '==', studentId).get()
  const conversationAttempts = await db.collection('conversationTextAttempts').where('studentId', '==', studentId).get()
  const vocabularyAttempts = attempts.docs.filter((doc) => doc.data().questionId?.startsWith(`e2e-vocabulary-${suffix}-`))
  const expectedAttempts = quizCount + cardCount + testCount + 10
  if (attempts.size !== expectedAttempts) throw new Error(`Expected ${expectedAttempts} durable question attempts, received ${attempts.size}`)
  if (conversationAttempts.size !== 1) throw new Error(`Expected 1 durable conversation attempt, received ${conversationAttempts.size}`)
  if (vocabularyAttempts.length !== 10) throw new Error(`Expected 10 durable vocabulary attempts, received ${vocabularyAttempts.length}`)

  console.log(JSON.stringify({ ok: true, flows: ['quiz', 'listening', 'test', 'conversation-text', 'vocabulary', 'adaptive'], durableAttempts: attempts.size, durableConversationAttempts: conversationAttempts.size, durableVocabularyAttempts: vocabularyAttempts.length }))
} finally {
  await context.close()
  await browser.close()
}
