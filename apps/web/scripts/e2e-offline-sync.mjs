import { chromium } from 'playwright'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-tuturai'
const suffix = Date.now()
const studentId = `e2e-offline-student-${suffix}`
const email = `${studentId}@example.test`
const password = 'E2eOfflinePassword123!'
const questionId = `e2e-conversation-${suffix}`

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run this script with Firebase Auth and Firestore emulators. It will not seed production Firebase.')
}

const app = getApps()[0] ?? initializeApp({ projectId })
const auth = getAuth(app)
const db = getFirestore(app)
const now = Timestamp.now()
await auth.createUser({ uid: studentId, email, password, displayName: 'E2E Offline Student' })
await Promise.all([
  db.collection('users').doc(studentId).set({ id: studentId, email, displayName: 'E2E Offline Student', role: 'student', xp: 0, level: 1, createdAt: now, updatedAt: now }),
  db.collection('questionBank').doc(questionId).set({ id: questionId, contentType: 'conversation', skill: 'speaking', level: 'beginner', prompt: 'Tell me about your favorite school subject.', options: [], explanation: '', tags: ['Offline'], status: 'published', createdAt: now, updatedAt: now }),
])

async function login(page) {
  await page.goto(`${baseURL}/auth/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Kata Sandi').fill(password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL(/\/siswa|\/dashboard/)
}

async function readQueuedTextMutations(page) {
  return page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('tuturai-offline')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not read offline mutation state'))
    })
    const mutations = await new Promise((resolve, reject) => {
      const request = database.transaction('pendingMutations', 'readonly').objectStore('pendingMutations').getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not read pending mutations'))
    })
    database.close()
    return mutations
      .filter((mutation) => mutation.operation === 'conversation-text')
      .map((mutation) => ({ status: mutation.status, payloadCleared: mutation.payload === null }))
  })
}

async function waitForSyncedTextMutation(page) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const mutations = await readQueuedTextMutations(page)
    const synced = mutations.find((mutation) => mutation.status === 'synced' && mutation.payloadCleared)
    if (synced) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Confirmed conversation text remained in IndexedDB: ${JSON.stringify(await readQueuedTextMutations(page))}`)
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()

try {
  await login(page)
  await page.goto(`${baseURL}/siswa/percakapan?questionId=${questionId}`)
  await page.getByRole('heading', { name: 'AI Conversation', exact: true }).waitFor()
  await page.getByText('Tell me about your favorite school subject.', { exact: false }).waitFor({ timeout: 10_000 })

  await context.setOffline(true)
  await page.getByLabel('Jawaban percakapan').fill('My favorite subject is English because I enjoy speaking practice.')
  await page.getByRole('button', { name: 'Kirim' }).click()
  await page.getByText('Jawaban disimpan di antrean offline', { exact: false }).waitFor()

  await context.setOffline(false)
  const deadline = Date.now() + 10_000
  let stored = null
  while (Date.now() < deadline) {
    const snapshot = await db.collection('conversationTextAttempts').where('studentId', '==', studentId).where('questionId', '==', questionId).get()
    if (!snapshot.empty) {
      stored = snapshot.docs[0].data()
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  if (!stored || typeof stored.score !== 'number') throw new Error('Offline mutation was not replayed with a confirmed score')
  const duplicates = await db.collection('conversationTextAttempts').where('studentId', '==', studentId).where('questionId', '==', questionId).get()
  if (duplicates.size !== 1) throw new Error(`Offline replay duplicated durable records: ${duplicates.size}`)
  await waitForSyncedTextMutation(page)

  await page.reload()
  await page.getByRole('heading', { name: 'AI Conversation', exact: true }).waitFor()
  await page.getByText('Tell me about your favorite school subject.', { exact: false }).waitFor()
  const afterReconnect = await db.collection('conversationTextAttempts').where('studentId', '==', studentId).where('questionId', '==', questionId).get()
  if (afterReconnect.size !== 1) throw new Error(`Online startup replay duplicated the confirmed record: ${afterReconnect.size}`)
  await waitForSyncedTextMutation(page)

  console.log(JSON.stringify({ ok: true, queued: true, replayed: true, onlineStartupReplayExactlyOnce: true, durableRecords: afterReconnect.size, payloadPurgedAfterConfirmation: true, score: stored.score }))
} finally {
  await context.close()
  await browser.close()
}
