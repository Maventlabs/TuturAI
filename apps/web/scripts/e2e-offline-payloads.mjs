import { chromium } from 'playwright'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-tuturai'
const suffix = Date.now()
const teacherId = `e2e-offline-payload-teacher-${suffix}`
const studentId = `e2e-offline-payload-student-${suffix}`
const classroomId = `e2e-offline-payload-classroom-${suffix}`
const assignmentId = `e2e-offline-payload-assignment-${suffix}`
const questionId = `e2e-offline-payload-conversation-${suffix}`
const email = `${studentId}@example.test`
const password = 'E2eOfflinePayloadPassword123!'

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run this script with Firebase Auth and Firestore emulators. It will not seed production Firebase.')
}

const app = getApps()[0] ?? initializeApp({ projectId })
const auth = getAuth(app)
const db = getFirestore(app)
const now = Timestamp.now()

await Promise.all([
  auth.createUser({ uid: teacherId, email: `teacher-${suffix}@example.test`, password, displayName: 'E2E Offline Payload Teacher' }),
  auth.createUser({ uid: studentId, email, password, displayName: 'E2E Offline Payload Student' }),
])

await Promise.all([
  db.collection('users').doc(teacherId).set({ id: teacherId, email: `teacher-${suffix}@example.test`, displayName: 'E2E Offline Payload Teacher', role: 'teacher', school: 'E2E', className: null, subject: 'English', xp: 0, level: 1, createdAt: now, updatedAt: now }),
  db.collection('users').doc(studentId).set({ id: studentId, email, displayName: 'E2E Offline Payload Student', role: 'student', school: 'E2E', className: null, subject: null, xp: 0, level: 1, createdAt: now, updatedAt: now }),
  db.collection('classrooms').doc(classroomId).set({ name: 'E2E Offline Payload Class', teacherId, status: 'active', description: 'Playwright fixture', school: 'E2E', joinKeyHash: 'b'.repeat(64), joinKeyRevoked: false, createdAt: now, updatedAt: now }),
  db.collection('classMemberships').doc(`${classroomId}_${studentId}`).set({ classId: classroomId, studentId, status: 'active', joinedAt: now }),
  db.collection('assignments').doc(assignmentId).set({ classId: classroomId, title: 'E2E Offline File Payload', instructions: 'Queue a file while offline.', status: 'published', maxAttempts: 2, dueAt: null, createdAt: now, updatedAt: now }),
  db.collection('questionBank').doc(questionId).set({ id: questionId, contentType: 'conversation', skill: 'speaking', level: 'beginner', prompt: 'Describe your daily learning routine.', options: [], explanation: '', tags: ['Offline'], status: 'published', createdAt: now, updatedAt: now }),
])

async function login(page) {
  await page.goto(`${baseURL}/auth/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Kata Sandi').fill(password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL(/\/siswa|\/dashboard/)
}

async function readOfflinePayloads(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('tuturai-offline')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not open offline database'))
    })
    const readStore = (name) => new Promise((resolve, reject) => {
      const request = db.transaction(name, 'readonly').objectStore(name).getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error(`Could not read ${name}`))
    })
    const mutations = await readStore('pendingMutations')
    const audioQueue = await readStore('audioQueue')
    return {
      mutations: mutations.map((entry) => ({
        operation: entry.operation,
        status: entry.status,
        idempotencyKey: entry.idempotencyKey,
        fileName: entry.payload?.file?.name ?? null,
        fileSize: entry.payload?.file instanceof Blob ? entry.payload.file.size : 0,
        audioSize: entry.payload?.audio instanceof Blob ? entry.payload.audio.size : 0,
        sessionId: entry.payload?.sessionId ?? null,
        expectedText: entry.payload?.expectedText ?? null,
      })),
      audioQueue: audioQueue.map((entry) => ({ id: entry.id, size: entry.value instanceof Blob ? entry.value.size : 0 })),
    }
  })
}

async function waitForMutationStatus(page, operation, statuses) {
  let latestPayloads
  const expectedStatuses = new Set(statuses)
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const payloads = await readOfflinePayloads(page)
    latestPayloads = payloads
    const mutation = payloads.mutations.find((entry) => entry.operation === operation)
    if (mutation && expectedStatuses.has(mutation.status)) return payloads
    await page.waitForTimeout(500)
  }
  throw new Error(`Offline mutation did not reach ${statuses.join(' or ')}: ${operation}; latest=${JSON.stringify(latestPayloads)}`)
}

const browser = await chromium.launch({
  headless: true,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
})
const context = await browser.newContext({ permissions: ['microphone'] })
const page = await context.newPage()
const audioContext = await browser.newContext({ permissions: ['microphone'] })
const audioPage = await audioContext.newPage()
const assessmentReplayResponses = []
audioPage.on('response', async (response) => {
  if (new URL(response.url()).pathname !== '/api/student/assessment' || response.request().method() !== 'POST') return
  const payload = await response.json().catch(() => ({}))
  assessmentReplayResponses.push({
    status: response.status(),
    errorCode: payload.error?.details?.code ?? payload.error?.code ?? null,
    retryable: payload.error?.details?.retryable ?? null,
  })
})

try {
  await login(page)

  await page.goto(`${baseURL}/siswa/penugasan`)
  const assignment = page.getByRole('heading', { name: 'E2E Offline File Payload', exact: true }).locator('xpath=../..')
  await assignment.waitFor()
  await page.locator('input[type=file]').first().setInputFiles({ name: 'offline-submission.txt', mimeType: 'text/plain', buffer: Buffer.from('offline assignment payload') })

  await context.setOffline(true)
  await assignment.getByRole('button', { name: 'Kumpulkan', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'disimpan di antrean offline' }).waitFor()

  const filePayload = await readOfflinePayloads(page)
  const fileMutation = filePayload.mutations.find((entry) => entry.operation === 'submit-assignment')
  if (!fileMutation || fileMutation.status !== 'pending' || fileMutation.fileName !== 'offline-submission.txt' || fileMutation.fileSize <= 0) {
    throw new Error(`Offline assignment file payload was not retained: ${JSON.stringify(filePayload)}`)
  }

  await context.setOffline(false)
  const assignmentReplay = await waitForMutationStatus(page, 'submit-assignment', ['failed', 'synced', 'conflict'])

  await login(audioPage)
  await audioPage.goto(`${baseURL}/siswa/percakapan?questionId=${questionId}`)
  await audioPage.getByRole('heading', { name: 'AI Conversation', exact: true }).waitFor()
  await audioPage.getByText('Describe your daily learning routine.', { exact: false }).waitFor({ timeout: 10_000 })
  await audioContext.setOffline(true)
  await audioPage.getByRole('button', { name: 'Rekam suara' }).click()
  await audioPage.getByRole('button', { name: 'Hentikan rekaman' }).waitFor({ timeout: 10_000 })
  await audioPage.waitForTimeout(750)
  await audioPage.getByRole('button', { name: 'Hentikan rekaman' }).click()
  await audioPage.waitForTimeout(2_000)

  const audioPayload = await readOfflinePayloads(audioPage)
  const audioMutation = audioPayload.mutations.find((entry) => entry.operation === 'assessment-audio')
  if (!audioMutation || audioMutation.status !== 'pending' || audioMutation.audioSize <= 0 || !audioMutation.sessionId || !audioMutation.expectedText) {
    throw new Error(`Offline conversation audio payload was not retained: ${JSON.stringify(audioPayload)}`)
  }
  if (audioMutation.idempotencyKey !== audioMutation.sessionId) {
    throw new Error(`Conversation audio idempotency key did not match sessionId: ${JSON.stringify(audioMutation)}`)
  }
  if (!audioPayload.audioQueue.some((entry) => entry.id === audioMutation.sessionId && entry.size > 0)) {
    throw new Error(`Offline conversation audio Blob was not retained in audioQueue: ${JSON.stringify(audioPayload)}`)
  }

  await audioContext.setOffline(false)
  const audioReplay = await waitForMutationStatus(audioPage, 'assessment-audio', ['failed', 'synced', 'conflict'])
  const audioReplayMutation = audioReplay.mutations.find((entry) => entry.operation === 'assessment-audio')
  if (audioReplayMutation?.status === 'synced') {
    const assessment = await db.collection('assessments').where('studentId', '==', studentId).where('sessionId', '==', audioMutation.sessionId).get()
    if (audioReplayMutation.audioSize > 0) {
      throw new Error(`Server-confirmed audio remains in the synced IndexedDB mutation: ${audioReplayMutation.audioSize} bytes`)
    }
    if (assessment.size !== 1 || audioReplay.audioQueue.some((entry) => entry.id === audioMutation.sessionId)) {
      throw new Error(`Successful audio replay did not confirm assessment persistence and cleanup: ${JSON.stringify({ audioReplay, assessmentCount: assessment.size })}`)
    }
  } else if (!audioReplay.audioQueue.some((entry) => entry.id === audioMutation.sessionId && entry.size > 0)) {
    throw new Error(`Failed audio replay removed the temporary Blob: ${JSON.stringify(audioReplay)}`)
  } else if (audioReplayMutation.audioSize <= 0) {
    throw new Error(`Failed audio replay removed the pending mutation payload: ${JSON.stringify(audioReplayMutation)}`)
  }

  console.log(JSON.stringify({ ok: true, assignmentFileQueued: true, assignmentReplayStatus: assignmentReplay.mutations.find((entry) => entry.operation === 'submit-assignment')?.status, conversationAudioQueued: true, conversationAudioReplayStatus: audioReplayMutation?.status, assessmentReplayResponses, audioSessionId: audioMutation.sessionId }))
} finally {
  await context.close()
  await audioContext.close()
  await browser.close()
}
