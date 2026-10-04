import { createHash, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createProdE2EConfig, PROD_E2E_SUITES } from './e2e-prod-config.mjs'
import {
  attachAdmin,
  cleanupTrackedDocuments,
  closeProdResources,
  createAdminClient,
  launchProdBrowser,
  loginWithPassword,
  logProdE2ERequest,
  logoutAndAssertUnauthorized,
  requestJson,
  trackCleanupAction,
  trackCleanupRef,
  verifyDedicatedIdentity,
  waitForApiResponse,
} from './e2e-prod-runtime.mjs'

const productionE2EEnvPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env.e2e.production')
if (existsSync(productionE2EEnvPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(productionE2EEnvPath)
}

function assert(condition, message) {
  if (!condition) {
    const error = new Error(message)
    error.name = 'ProdE2EError'
    throw error
  }
}

function assertJsonResponse(response) {
  assert(response.headers()['content-type']?.includes('application/json'), 'Protected API failure was not JSON.')
}

function audioMimeType(filePath) {
  const mimeType = { '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.webm': 'audio/webm' }[extname(filePath).toLowerCase()]
  assert(Boolean(mimeType), 'Production E2E audio fixture must use a supported audio extension.')
  return mimeType
}

function driveMimeType(filePath) {
  const mimeType = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  }[extname(filePath).toLowerCase()]
  assert(Boolean(mimeType), 'Production E2E Drive fixture must use a supported document or image extension.')
  return mimeType
}

function safeDriveName(name) {
  return name.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 180) || 'e2e-file'
}

async function gotoSettled(page, url) {
  await page.goto(url.toString())
  try {
    // Reaching a network-idle window proves client hydration effects ran, so
    // immediately following clicks/selects cannot race unattached handlers.
    await page.waitForLoadState('networkidle', { timeout: 8_000 })
  } catch {
    // Pages with continuous background activity must not hang navigation.
  }
}

// A form field that is populated from the server does not hold its value in
// the same tick as a reload: the client must refetch first. Poll the rendered
// value so the assertion proves durability rather than hydration timing.
async function waitForInputValue(locator, expected, label, timeout = 30_000) {
  const deadline = Date.now() + timeout
  let observed = ''
  while (Date.now() < deadline) {
    observed = await locator.inputValue().catch(() => '')
    if (observed === expected) return observed
    await page_wait(250)
  }
  throw new Error(`${label} did not render the persisted value within ${timeout}ms (expected ${JSON.stringify(expected)}, saw ${JSON.stringify(observed)}).`)
}

async function waitForInnerText(locator, expected, label, timeout = 30_000) {
  const deadline = Date.now() + timeout
  let observed = ''
  while (Date.now() < deadline) {
    observed = (await locator.innerText().catch(() => '')).trim()
    if (observed === expected) return observed
    await page_wait(250)
  }
  throw new Error(`${label} did not render the persisted value within ${timeout}ms (expected ${JSON.stringify(expected)}, saw ${JSON.stringify(observed)}).`)
}

// Same hydration concern as `waitForInputValue`: a server-backed control only
// reflects persisted state after the client refetches it.
async function waitForAttribute(locator, attribute, expected, label, timeout = 30_000) {
  const deadline = Date.now() + timeout
  let observed = null
  while (Date.now() < deadline) {
    observed = await locator.getAttribute(attribute).catch(() => null)
    if (observed === expected) return observed
    await page_wait(250)
  }
  throw new Error(`${label} did not render the persisted value within ${timeout}ms (expected ${JSON.stringify(expected)}, saw ${JSON.stringify(observed)}).`)
}

function page_wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms))
}

// Read-only page snapshot attached to a FAIL report so a locator timeout says
// what was actually rendered instead of only what was expected.
async function captureFailureContext(page, cause) {
  const mainText = await page.locator('main').innerText().catch(() => null)
  const buttons = await page.getByRole('button').evaluateAll((nodes) => nodes.map((n) => `${n.textContent?.trim()}|disabled=${n.disabled}`)).catch(() => null)
  globalThis.__prodE2EFailureContext = {
    url: page.url(),
    mainText: mainText?.replace(/\n+/g, ' | ').slice(0, 800) ?? null,
    buttons,
  }
  throw cause
}

async function ensureDriveConnected(page, config) {
  const current = await requestJson(page, config.baseUrl, '/api/integrations/google-drive/status', {}, 'google-drive')
  assert(current.response.status() === 200 && typeof current.body?.data?.connected === 'boolean', 'Google Drive status is unavailable.')
  if (!current.body.data.connected) {
    assert(!config.headless, 'Set E2E_HEADLESS=false before the dedicated Google Drive consent checkpoint.')
    await gotoSettled(page, new URL('/guru/pengaturan', config.baseUrl))
    console.log('HUMAN CHECKPOINT: connect Drive using the dedicated account identified by E2E_DRIVE_ACCOUNT_EMAIL; do not select a personal Drive account.')
    const connectedNavigation = page.waitForURL((url) => url.pathname === '/guru/pengaturan' && url.searchParams.get('drive') === 'connected', { timeout: 180_000 })
    await page.getByRole('link', { name: /Hubungkan/ }).click()
    await connectedNavigation
  }
  const verified = await requestJson(page, config.baseUrl, '/api/integrations/google-drive/status', {}, 'google-drive')
  assert(verified.response.status() === 200 && verified.body?.data?.connected === true, 'Google Drive consent did not persist a teacher connection.')
  assert(verified.body.data.scope === 'https://www.googleapis.com/auth/drive.file', 'Drive connection exceeded or failed to grant the expected drive.file scope.')
  return verified.body.data
}

async function cleanupDriveFile(page, config, input, uploadIdempotencyKey = null) {
  const result = await requestJson(page, config.baseUrl, '/api/integrations/google-drive/test-cleanup', {
    method: 'DELETE',
    data: {
      assignmentId: input.assignmentId,
      fileId: input.fileId,
      testPrefix: config.testPrefix,
      ...(input.submissionId ? { submissionId: input.submissionId } : {}),
      ...(uploadIdempotencyKey ? { uploadIdempotencyKey } : {}),
    },
  }, 'google-drive')
  assert(result.response.status() === 200, `E2E Drive cleanup was not confirmed (${result.response.status()}).`)
}

function operationIdForDriveUpload(teacherId, uploadIdempotencyKey) {
  return createHash('sha256').update(`${teacherId}:${uploadIdempotencyKey}`).digest('hex')
}

async function operationFileId(db, teacherId, uploadIdempotencyKey) {
  const operation = await db.collection('googleDriveUploadOperations').doc(operationIdForDriveUpload(teacherId, uploadIdempotencyKey)).get()
  if (!operation.exists || operation.data()?.teacherId !== teacherId) return null
  return typeof operation.data()?.driveFileId === 'string' ? operation.data().driveFileId : null
}

async function readOfflineMutationState(page, operation) {
  return page.evaluate(async (targetOperation) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('tuturai-offline')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Could not open offline database'))
    })
    const readAll = (storeName) => new Promise((resolve, reject) => {
      const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error(`Could not read ${storeName}`))
    })
    const [mutations, audioQueue] = await Promise.all([readAll('pendingMutations'), readAll('audioQueue')])
    const mutation = mutations.find((entry) => entry.operation === targetOperation)
    const payload = mutation?.payload
    return {
      id: mutation?.id ?? null,
      operation: mutation?.operation ?? null,
      status: mutation?.status ?? null,
      idempotencyKey: mutation?.idempotencyKey ?? null,
      fileName: payload?.file?.name ?? null,
      fileSize: payload?.file instanceof Blob ? payload.file.size : 0,
      audioSize: payload?.audio instanceof Blob ? payload.audio.size : 0,
      sessionId: payload?.sessionId ?? null,
      attemptId: payload?.attemptId ?? null,
      questionId: payload?.questionId ?? null,
      expectedText: payload?.expectedText ?? null,
      audioQueue: audioQueue.map((entry) => ({ id: entry.id, size: entry.value instanceof Blob ? entry.value.size : 0 })),
    }
  }, operation)
}

async function waitForOfflineMutation(page, operation, expectedStatus, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  let latest = null
  while (Date.now() < deadline) {
    latest = await readOfflineMutationState(page, operation)
    if (latest.status === expectedStatus) return latest
    if (latest.status === 'conflict') throw new Error(`Production offline mutation entered conflict: ${operation}`)
    if (latest.status === 'failed') throw new Error(`Production offline mutation failed instead of syncing: ${operation}`)
    await page.waitForTimeout(500)
  }
  throw new Error(`Production offline mutation did not reach ${expectedStatus}: ${operation}; last status=${latest?.status ?? 'missing'}`)
}

async function runSmoke(config) {
  const resources = await launchProdBrowser(config)
  try {
    const pageResponse = await resources.page.goto(config.baseUrl.toString())
    assert(pageResponse?.status() === 200, `Homepage returned ${pageResponse?.status() ?? 'no response'}.`)
    const headers = await pageResponse.allHeaders()
    for (const name of ['content-security-policy', 'strict-transport-security', 'x-content-type-options']) {
      assert(Boolean(headers[name]), `Production response is missing ${name}.`)
    }
    // The landing redesign renders the login CTA via the shared button component
    // (<a role="button">), so match the accessible button name, not the link role.
    await resources.page.getByRole('button', { name: 'Sudah punya akun?' }).waitFor()

    const health = await requestJson(resources.page, config.baseUrl, '/api/health')
    assert(health.response.status() === 200 && health.body?.data?.status === 'ok', 'Liveness endpoint did not report process reachability.')
    assert(health.body.data.dependencies === 'not_checked', 'Liveness endpoint incorrectly claimed dependency readiness.')

    const protectedStatuses = {}
    for (const path of ['/api/me', '/api/classrooms', '/api/student/dashboard']) {
      const result = await requestJson(resources.page, config.baseUrl, path)
      assert(result.response.status() === 401, `${path} should return JSON 401 without a session; got ${result.response.status()}.`)
      assertJsonResponse(result.response)
      assert(Boolean(result.body?.error?.code), `${path} returned no API error code.`)
      protectedStatuses[path] = result.response.status()
    }
    const readiness = await requestJson(resources.page, config.baseUrl, '/api/health/readiness')
    assert(readiness.response.status() === 401, 'Readiness diagnostics must require an authenticated teacher.')
    assertJsonResponse(readiness.response)

    console.log(JSON.stringify({
      suite: 'smoke',
      status: 'PASS',
      page: pageResponse.status(),
      csp: true,
      health: health.response.status(),
      unauthenticatedProtected: protectedStatuses,
      readinessUnauthorized: readiness.response.status(),
    }))
  } finally {
    await closeProdResources(resources, [], false)
  }
}

async function runAuth(config) {
  const admin = createAdminClient(config)
  const studentUid = await verifyDedicatedIdentity(admin.auth, admin.db, config.student, 'student')
  const teacherUid = await verifyDedicatedIdentity(admin.auth, admin.db, config.teacher, 'teacher')
  const resources = attachAdmin(await launchProdBrowser(config), admin)
  const cleanup = []
  const results = []

  try {
    for (const [role, identity] of [['student', config.student], ['teacher', config.teacher]]) {
      const context = await resources.browser.newContext()
      const page = await context.newPage()
      try {
        const profile = await loginWithPassword(page, config, identity, role)
        assert(profile.id === (role === 'student' ? studentUid : teacherUid), `${role} session UID changed.`)
        await logoutAndAssertUnauthorized(page, config)
        results.push({ role, passwordLogin: true, serverSession: true, restore: true, logout401: true })
      } finally {
        await context.close()
      }
    }

    const context = await resources.browser.newContext()
    const page = await context.newPage()
    let googleUid = null
    try {
      await page.goto(new URL('/auth/sign-up', config.baseUrl).toString())
      const roleName = config.googleAuth.role === 'teacher' ? 'Guru' : 'Siswa'
      await page.getByRole('button', { name: roleName, exact: true }).click()
      await page.getByLabel('Nama Lengkap').fill(`${config.testPrefix} Google test`)
      await page.getByLabel('Asal Sekolah').fill(`${config.testPrefix} School`)
      await page.getByLabel(config.googleAuth.role === 'teacher' ? 'Mata Pelajaran' : 'Kelas').fill('E2E')
      const previousUser = await admin.auth.getUserByEmail(config.googleAuth.email).catch((error) => {
        if (error?.code === 'auth/user-not-found') return null
        throw error
      })

      console.log('HUMAN CHECKPOINT: complete Google sign-in with the dedicated account configured by E2E_GOOGLE_AUTH_EMAIL; the script will resume automatically.')
      const popupPromise = page.waitForEvent('popup', { timeout: 15_000 })
      await page.getByRole('button', { name: 'Daftar dengan Google', exact: true }).click()
      const popup = await popupPromise
      await popup.waitForEvent('close', { timeout: 180_000 })
      const googleUser = await admin.auth.getUserByEmail(config.googleAuth.email)
      googleUid = googleUser.uid
      if (!previousUser) {
        const firestoreProfileRef = admin.db.collection('users').doc(googleUid)
        trackCleanupAction(cleanup, async () => {
          await firestoreProfileRef.delete()
          await admin.auth.deleteUser(googleUid)
        })
      }
      const rolePath = config.googleAuth.role === 'teacher' ? '/guru' : '/siswa'
      await page.waitForURL((url) => url.pathname === '/dashboard' || url.pathname.startsWith(rolePath), { timeout: 60_000 })

      const profileResult = await requestJson(page, config.baseUrl, '/api/me', {}, 'firebase-admin')
      assert(profileResult.response.status() === 200, 'Google sign-in did not establish the server session.')
      assert(profileResult.body?.data?.profile?.role === config.googleAuth.role, 'Google account role does not match the configured E2E role.')
      assert(profileResult.body?.data?.profile?.email?.toLowerCase() === config.googleAuth.email.toLowerCase(), 'Google session email does not match the dedicated E2E account.')
      assert(profileResult.body.data.profile.id === googleUid, 'Google session UID did not match Firebase Auth.')
      const firestoreProfileRef = admin.db.collection('users').doc(googleUid)
      const firestoreProfile = await firestoreProfileRef.get()
      assert(firestoreProfile.exists && firestoreProfile.data()?.role === config.googleAuth.role, 'Google onboarding role did not persist in Firestore.')
      await page.reload()
      await page.waitForURL((url) => url.pathname.startsWith(rolePath), { timeout: 30_000 })
      await logoutAndAssertUnauthorized(page, config)

      results.push({ googleLogin: true, onboarding: !previousUser, session: true, restore: true, logout401: true })
    } finally {
      await context.close()
    }

    console.log(JSON.stringify({ suite: 'auth', status: 'PASS', flows: results }))
  } finally {
    await closeProdResources(resources, cleanup, config.cleanupAfterRun)
  }
}

async function runSecurity(config) {
  const admin = createAdminClient(config)
  const studentUid = await verifyDedicatedIdentity(admin.auth, admin.db, config.student, 'student')
  await verifyDedicatedIdentity(admin.auth, admin.db, config.teacher, 'teacher')
  const foreignTeacherUid = await verifyDedicatedIdentity(admin.auth, admin.db, config.foreignTeacher, 'teacher')
  const resources = attachAdmin(await launchProdBrowser(config), admin)
  const studentContext = await resources.browser.newContext()
  const teacherContext = await resources.browser.newContext()
  const studentPage = await studentContext.newPage()
  const teacherPage = await teacherContext.newPage()

  try {
    await loginWithPassword(studentPage, config, config.student, 'student')
    await loginWithPassword(teacherPage, config, config.teacher, 'teacher')

    const studentToTeacher = await requestJson(studentPage, config.baseUrl, '/api/teacher/devices')
    assert(studentToTeacher.response.status() === 403, `Student-to-teacher boundary returned ${studentToTeacher.response.status()}.`)
    const teacherToStudent = await requestJson(teacherPage, config.baseUrl, '/api/student/dashboard')
    assert(teacherToStudent.response.status() === 403, `Teacher-to-student boundary returned ${teacherToStudent.response.status()}.`)

    const foreignClassroom = await admin.db.collection('classrooms').doc(config.foreignClassroomId).get()
    assert(foreignClassroom.exists && foreignClassroom.data()?.teacherId === foreignTeacherUid, 'E2E_FOREIGN_CLASSROOM_ID must belong to E2E_FOREIGN_TEACHER_UID.')
    const wrongClass = await requestJson(teacherPage, config.baseUrl, `/api/classrooms/${encodeURIComponent(config.foreignClassroomId)}/members`)
    assert([403, 404].includes(wrongClass.response.status()), `Wrong-class read returned ${wrongClass.response.status()}.`)

    const revokedClassroom = await admin.db.collection('classrooms').doc(config.revokedJoinClassroomId).get()
    const expectedJoinHash = createHash('sha256').update(config.revokedJoinKey).digest('hex')
    assert(revokedClassroom.exists && revokedClassroom.data()?.joinKeyRevoked === true, 'E2E_REVOKED_JOIN_CLASSROOM_ID must have a revoked join key.')
    assert(revokedClassroom.data()?.joinKeyHash === expectedJoinHash, 'E2E_REVOKED_JOIN_KEY does not match the dedicated revoked classroom fixture.')
    const revokedMembershipRef = admin.db.collection('classMemberships').doc(`${config.revokedJoinClassroomId}_${studentUid}`)
    const before = await revokedMembershipRef.get()
    assert(!before.exists, 'The dedicated student is already a member of the revoked-key test classroom.')
    const revokedJoin = await requestJson(studentPage, config.baseUrl, '/api/classrooms/join', {
      method: 'POST',
      data: { joinKey: config.revokedJoinKey },
    })
    assert([404, 409].includes(revokedJoin.response.status()), `Revoked join key returned ${revokedJoin.response.status()}.`)
    assert(!(await revokedMembershipRef.get()).exists, 'Revoked join-key rejection created a membership.')

    console.log(JSON.stringify({ suite: 'security', status: 'PASS', studentToTeacher: studentToTeacher.response.status(), teacherToStudent: teacherToStudent.response.status(), wrongClass: wrongClass.response.status(), revokedJoin: revokedJoin.response.status(), mutationCount: 0 }))
  } finally {
    await studentContext.close()
    await teacherContext.close()
    await closeProdResources(resources, [], false)
  }
}

// The deployed vocabulary session presents one card at a time and only opens
// the "Kosakata selesai!" dialog once every card in the returned bank has been
// confirmed by the server. Drive the real session end-to-end and read the
// rendered mastery counter back instead of guessing a card count.
async function masterVocabularySession(page) {
  const masteryButton = page.getByRole('button', { name: 'Sudah hafal', exact: true })
  await masteryButton.waitFor()
  const dialog = page.getByRole('dialog')
  const readMastery = async () => {
    const counter = (await page.getByText('Dikuasai', { exact: true }).locator('xpath=..').innerText()).replace(/\s+/g, ' ')
    const match = /(\d+)\s*\/\s*(\d+)/.exec(counter)
    assert(match, 'Vocabulary mastery counter did not render a mastered/total ratio.')
    return { mastered: Number(match[1]), total: Number(match[2]) }
  }

  const start = await readMastery()
  assert(start.total >= 10, `Vocabulary fixture bank returned only ${start.total} cards.`)
  for (let attempt = 0; attempt < start.total * 2 + 5; attempt += 1) {
    if (await dialog.isVisible()) break
    const before = await readMastery()
    if (before.mastered >= before.total) break
    // Each confirmation is a real production write. Serialize on the server
    // answer so a click is never queued while the previous save is still in
    // flight, and keep the durable 200 as evidence for every card.
    const saved = await waitForApiResponse(page, '/api/student/question-bank', 'POST', () => masteryButton.click({ timeout: 30_000 }))
    assert(saved.response.status() === 200 && saved.body?.data?.isCorrect === true, `Vocabulary mastery save returned ${saved.response.status()}.`)
    await page.waitForTimeout(500)
  }
  await dialog.getByText('Kosakata selesai!').waitFor({ timeout: 30_000 })
  const completionMessage = dialog.getByText('Semua kartu kosakata pada sesi ini sudah dikonfirmasi tersimpan.')
  await completionMessage.waitFor()
  const finished = await readMastery()
  assert(finished.mastered === finished.total, `Vocabulary session ended at ${finished.mastered}/${finished.total} confirmed cards.`)
  await dialog.getByText(`${finished.total}/${finished.total}`, { exact: true }).waitFor()
  return { total: finished.total, completionMessage: await completionMessage.innerText() }
}

async function runClassroom(config) {
  const admin = createAdminClient(config)
  const studentUid = await verifyDedicatedIdentity(admin.auth, admin.db, config.student, 'student')
  await verifyDedicatedIdentity(admin.auth, admin.db, config.teacher, 'teacher')
  const resources = attachAdmin(await launchProdBrowser(config), admin)
  const cleanup = []
  const studentRef = admin.db.collection('users').doc(studentUid)
  const previousStudent = await studentRef.get()
  const previousStudentData = previousStudent.exists ? previousStudent.data() : null
  trackCleanupAction(cleanup, async () => {
    if (previousStudentData) await studentRef.set(previousStudentData)
  })
  const teacherPage = await resources.context.newPage()
  const studentContext = await resources.browser.newContext()
  const studentPage = await studentContext.newPage()
  let classroomId = null

  try {
    await loginWithPassword(teacherPage, config, config.teacher, 'teacher')
    await gotoSettled(teacherPage, new URL('/guru/kelas', config.baseUrl))
    const classroomName = `${config.testPrefix} Classroom ${randomUUID().slice(0, 8)}`
    await teacherPage.getByRole('heading', { name: 'Buat classroom', exact: true }).waitFor()
    await teacherPage.getByLabel('Nama kelas').fill(classroomName)
    await teacherPage.getByLabel('Sekolah (opsional)').fill(`${config.testPrefix} School`)
    await teacherPage.getByLabel('Deskripsi (opsional)').fill('Dedicated production E2E classroom fixture.')
    const created = await waitForApiResponse(teacherPage, '/api/classrooms', 'POST', () => teacherPage.getByRole('button', { name: 'Buat kelas', exact: true }).click())
    assert(created.response.status() === 201, `Classroom creation returned ${created.response.status()}.`)
    classroomId = created.body?.data?.id
    const joinKey = created.body?.data?.joinKey
    assert(typeof classroomId === 'string' && typeof joinKey === 'string', 'Classroom API did not return a classroom ID and join key.')
    const joinKeyHash = createHash('sha256').update(joinKey).digest('hex')
    const classroomRef = admin.db.collection('classrooms').doc(classroomId)
    const reservationRef = admin.db.collection('classroomJoinKeys').doc(joinKeyHash)
    trackCleanupRef(cleanup, classroomRef)
    trackCleanupRef(cleanup, reservationRef)
    const classroom = await classroomRef.get()
    const reservation = await reservationRef.get()
    assert(classroom.exists && classroom.data()?.teacherId === config.teacher.uid, 'Classroom owner did not persist in Firestore.')
    assert(classroom.data()?.joinKeyHash === joinKeyHash && !('joinKey' in classroom.data()), 'Classroom join key was not stored as a hash only.')
    assert(reservation.exists && reservation.data()?.classroomId === classroomId, 'Join-key reservation did not persist.')
    await teacherPage.getByText(`Kode join untuk ${classroomName}`, { exact: true }).waitFor()

    await loginWithPassword(studentPage, config, config.student, 'student')
    await gotoSettled(studentPage, new URL('/siswa', config.baseUrl))
    await studentPage.getByLabel('Kode join classroom').fill(joinKey)
    const joined = await waitForApiResponse(studentPage, '/api/classrooms/join', 'POST', () => studentPage.getByRole('button', { name: 'Gabung', exact: true }).click())
    assert(joined.response.status() === 201, `Student classroom join returned ${joined.response.status()}.`)
    const membershipId = `${classroomId}_${studentUid}`
    const membershipRef = admin.db.collection('classMemberships').doc(membershipId)
    trackCleanupRef(cleanup, membershipRef)
    const membership = await membershipRef.get()
    assert(membership.exists && membership.data()?.status === 'active', 'Student membership did not persist in Firestore.')
    await studentPage.reload()
    await studentPage.getByText(classroomName, { exact: true }).first().waitFor()
    // A dedicated E2E student may already hold an active class from provisioning;
    // the product keeps the previous active class on join. Verify the durable
    // class-switcher path instead: activate the new classroom, then reload.
    const activeClassroom = studentPage.getByLabel('Pilih classroom aktif')
    await activeClassroom.selectOption(classroomId)
    await studentPage.reload()
    await studentPage.getByText(classroomName, { exact: true }).first().waitFor()
    assert(await studentPage.getByLabel('Pilih classroom aktif').inputValue() === classroomId, 'Student active-class selection did not survive reload.')

    const memberReadback = await requestJson(teacherPage, config.baseUrl, `/api/classrooms/${encodeURIComponent(classroomId)}/members`)
    assert(memberReadback.response.status() === 200, 'Teacher member API failed to read back the student.')
    assert(memberReadback.body?.data?.some((member) => member.studentId === studentUid), 'Teacher API did not show the joined student.')
    await gotoSettled(teacherPage, new URL('/guru/siswa', config.baseUrl))
    await teacherPage.getByRole('heading', { name: 'Daftar Siswa', exact: true }).waitFor()

    console.log(JSON.stringify({ suite: 'classroom', status: 'PASS', classroomPersisted: true, joinKeyHashPersisted: true, membershipPersisted: true, teacherReadback: true, reload: true, fixturePrefix: config.testPrefix }))
  } finally {
    await studentContext.close()
    await closeProdResources(resources, cleanup, config.cleanupAfterRun)
  }
}

async function assertClassroomFixture(db, config) {
  const classroom = await db.collection('classrooms').doc(config.classroomId).get()
  assert(classroom.exists && classroom.data()?.status === 'active', 'E2E_CLASSROOM_ID must identify an active dedicated test classroom.')
  assert(classroom.data()?.teacherId === config.teacher.uid, 'E2E_CLASSROOM_ID must be owned by E2E_TEACHER_UID.')
  const membership = await db.collection('classMemberships').doc(`${config.classroomId}_${config.student.uid}`).get()
  assert(membership.exists && membership.data()?.status === 'active', 'E2E_STUDENT_UID must be an active member of E2E_CLASSROOM_ID.')
  return classroom.data()
}

async function restoreDocument(cleanup, reference) {
  const snapshot = await reference.get()
  if (!snapshot.exists) {
    trackCleanupRef(cleanup, reference)
    return null
  }
  const original = snapshot.data()
  trackCleanupAction(cleanup, () => reference.set(original))
  return original
}

function localDateTime(minutesAgo) {
  const date = new Date(Date.now() - minutesAgo * 60_000)
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

async function runTeacher(config) {
  const admin = createAdminClient(config)
  const teacherUid = await verifyDedicatedIdentity(admin.auth, admin.db, config.teacher, 'teacher')
  const studentUid = await verifyDedicatedIdentity(admin.auth, admin.db, config.student, 'student')
  await assertClassroomFixture(admin.db, config)
  const resources = attachAdmin(await launchProdBrowser(config), admin)
  const cleanup = []
  const teacherRef = admin.db.collection('users').doc(teacherUid)
  const previousTeacher = await restoreDocument(cleanup, teacherRef)
  const page = resources.page

  try {
    await loginWithPassword(page, config, config.teacher, 'teacher')
    await page.getByRole('heading', { name: 'Dashboard Guru', exact: true }).waitFor()

    const members = await requestJson(page, config.baseUrl, `/api/classrooms/${encodeURIComponent(config.classroomId)}/members`)
    assert(members.response.status() === 200, 'Teacher student-monitoring API did not return 200.')
    assert(members.body?.data?.some((member) => member.studentId === studentUid), 'Teacher members API did not return the dedicated test student.')
    await page.goto(new URL('/guru/siswa', config.baseUrl).toString())
    await page.getByRole('heading', { name: 'Daftar Siswa', exact: true }).waitFor()
    const studentName = String((await admin.db.collection('users').doc(studentUid).get()).data()?.displayName ?? '')
    assert(studentName.length > 0, 'Dedicated student profile has no display name.')
    await page.getByRole('link', { name: studentName, exact: true }).first().click()
    await page.waitForURL(new URL(`/guru/siswa/${encodeURIComponent(studentUid)}`, config.baseUrl).toString(), { timeout: 30_000 })
    await page.getByRole('heading', { name: studentName, exact: true }).waitFor()
    const studentDetails = await requestJson(page, config.baseUrl, `/api/teacher/students/${encodeURIComponent(studentUid)}`)
    assert(studentDetails.response.status() === 200, 'Teacher student-detail API did not return 200.')
    assert(studentDetails.body?.data?.student?.id === studentUid && studentDetails.body?.data?.classrooms?.some((item) => item.id === config.classroomId), 'Teacher student details were not scoped to the expected classroom.')

    const analyticsPath = `/api/teacher/analytics?period=7d&classroomId=${encodeURIComponent(config.classroomId)}`
    const analytics = await requestJson(page, config.baseUrl, analyticsPath)
    assert(analytics.response.status() === 200, 'Teacher classroom analytics did not load.')
    assert(analytics.body?.data?.summary?.studentCount === 1, 'Analytics did not reflect the dedicated classroom membership.')
    const reportAnalytics = await requestJson(page, config.baseUrl, '/api/teacher/analytics?period=all')
    assert(reportAnalytics.response.status() === 200, 'Teacher report source analytics did not load.')
    await gotoSettled(page, new URL('/guru/analitik', config.baseUrl))
    await page.getByRole('heading', { name: 'Analitik Mendalam', exact: true }).waitFor()
    await page.getByText('1', { exact: true }).first().waitFor()

    const reportResponsePromise = page.waitForResponse((response) => (
      new URL(response.url()).pathname === '/api/teacher/reports'
      && response.request().method() === 'GET'
    ))
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Unduh PDF', exact: true }).click()
    const [reportResponse, download] = await Promise.all([reportResponsePromise, downloadPromise])
    assert(reportResponse.status() === 200 && reportResponse.headers()['content-type']?.includes('application/pdf'), 'Teacher report did not return a PDF.')
    const reportBytes = await readFile(await download.path())
    const reportText = reportBytes.toString('latin1')
    assert(reportBytes.byteLength > 100 && reportText.startsWith('%PDF-'), 'Downloaded teacher report is empty or not a PDF.')
    assert(reportText.includes('TuturAI Learning Report'), 'PDF report did not include its report title.')
    assert(reportText.includes(`Jumlah siswa: ${reportAnalytics.body.data.summary.studentCount}`), 'PDF report did not match the analytics student count.')
    assert(reportText.includes(`Attempt latihan: ${reportAnalytics.body.data.summary.practiceAttempts}`), 'PDF report did not match the analytics attempt count.')

    await gotoSettled(page, new URL('/guru/pengaturan', config.baseUrl))
    await page.getByRole('heading', { name: 'Pengaturan', exact: true }).waitFor()
    const switches = page.getByRole('switch')
    await switches.first().waitFor()
    const priorChecked = await switches.first().getAttribute('aria-checked')
    assert(priorChecked === 'true' || priorChecked === 'false', 'Notification switch state is not accessible.')
    await switches.first().click()
    await page.getByRole('button', { name: 'Simpan preferensi', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'Preferensi notifikasi tersimpan di server.' }).waitFor()
    const preferences = await requestJson(page, config.baseUrl, '/api/teacher/preferences')
    assert(preferences.response.status() === 200, 'Saved teacher settings did not read back through the server API.')
    assert(preferences.body?.data?.submissions === (priorChecked !== 'true'), 'Saved teacher setting did not match the UI action.')
    await page.reload()
    await page.getByRole('heading', { name: 'Pengaturan', exact: true }).waitFor()
    const restoredSetting = await waitForAttribute(page.getByRole('switch').first(), 'aria-checked', String(preferences.body.data.submissions), 'Teacher notification switch')
    assert(restoredSetting === String(preferences.body.data.submissions), 'Teacher setting did not restore after reload.')

    const persistedPreferences = (await teacherRef.get()).data()?.teacherPreferences
    assert(persistedPreferences?.submissions === preferences.body.data.submissions, 'Teacher settings were not persisted in Firestore.')

    const studentRef = admin.db.collection('users').doc(studentUid)
    await restoreDocument(cleanup, studentRef)
    await studentRef.update({ xp: 1_000_000 })
    const leaderboardRunId = randomUUID().replaceAll('-', '').slice(0, 8)
    const leaderboardFixtures = [
      { suffix: 'mid', name: `${config.testPrefix} Rank Mid`, xp: 500_000 },
      { suffix: 'low', name: `${config.testPrefix} Rank Low`, xp: 100 },
      { suffix: 'bottom', name: `${config.testPrefix} Rank Bottom`, xp: 1 },
    ].map((fixture) => ({ ...fixture, id: `e2e-${config.testPrefix}-${leaderboardRunId}-${fixture.suffix}` }))
    for (const fixture of leaderboardFixtures) {
      const fixtureUserRef = admin.db.collection('users').doc(fixture.id)
      const fixtureMembershipRef = admin.db.collection('classMemberships').doc(`${config.classroomId}_${fixture.id}`)
      trackCleanupRef(cleanup, fixtureUserRef)
      trackCleanupRef(cleanup, fixtureMembershipRef)
      await fixtureUserRef.create({ id: fixture.id, email: `${fixture.id}@example.test`, displayName: fixture.name, role: 'student', school: config.testPrefix, xp: fixture.xp, level: 1, streak: 0, createdAt: new Date(), updatedAt: new Date() })
      await fixtureMembershipRef.create({ classId: config.classroomId, studentId: fixture.id, status: 'active', joinedAt: new Date() })
    }
    const leaderboardResult = await requestJson(page, config.baseUrl, '/api/teacher/leaderboard')
    assert(leaderboardResult.response.status() === 200 && Array.isArray(leaderboardResult.body?.data), 'Teacher leaderboard did not read back server-backed rankings.')
    const teacherRows = leaderboardResult.body.data
    const firstPlace = teacherRows.find((row) => row.studentId === studentUid)
    const lastFixture = teacherRows.find((row) => row.studentId === leaderboardFixtures[2].id)
    assert(firstPlace?.rank === 1 && firstPlace.xp === 1_000_000, 'Teacher leaderboard did not rank the persisted XP leader first.')
    assert(lastFixture && lastFixture.rank > firstPlace.rank && lastFixture.xp === 1, 'Teacher leaderboard did not order lower persisted XP after the leader.')
    await gotoSettled(page, new URL('/guru/leaderboard', config.baseUrl))
    await page.getByRole('heading', { name: 'Papan Peringkat', exact: true }).waitFor()
    // The top three render as a podium with medal icons and no numeric rank, so
    // the server-provided rank is asserted on the ranked list, where the page
    // actually displays it, against the same `lastFixture` row the API ranked.
    const renderedLastRow = page.getByText(lastFixture.name, { exact: true }).locator('xpath=../..')
    await renderedLastRow.waitFor()
    assert(Number(await renderedLastRow.locator('span').first().innerText()) === lastFixture.rank, 'Teacher leaderboard UI rank did not match the server result.')
    await page.reload()
    await page.getByRole('heading', { name: 'Papan Peringkat', exact: true }).waitFor()
    const reloadedRankRow = page.getByText(lastFixture.name, { exact: true }).locator('xpath=../..')
    await reloadedRankRow.waitFor()
    const reloadedRank = await waitForInnerText(reloadedRankRow.locator('span').first(), String(lastFixture.rank), 'Teacher leaderboard rank after reload')
    assert(Number(reloadedRank) === lastFixture.rank, 'Teacher leaderboard rank did not persist after reload.')

    const deviceId = `e2e-${config.testPrefix}-${randomUUID().replaceAll('-', '').slice(0, 12)}`
    const deviceRef = trackCleanupRef(cleanup, admin.db.collection('devices').doc(deviceId))
    await gotoSettled(page, new URL('/guru/perangkat', config.baseUrl))
    await page.getByRole('heading', { name: 'Perangkat TuturAI', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Daftarkan Perangkat', exact: true }).click()
    await page.getByLabel('Device ID').fill(deviceId)
    await page.getByLabel('Classroom ID (opsional)').fill(config.classroomId)
    await page.getByRole('button', { name: 'Daftarkan', exact: true }).click()
    const credentialMessage = await page.getByRole('status').filter({ hasText: 'Credential perangkat dibuat.' }).innerText()
    const credentialMatch = credentialMessage.match(/Simpan sekali sekarang:\s*([A-Za-z0-9_-]{40,})/)
    assert(credentialMatch, 'Device registration did not show the one-time credential returned by the server.')
    await page.getByText(deviceId, { exact: true }).waitFor()
    const registeredDevice = await requestJson(page, config.baseUrl, '/api/teacher/devices')
    assert(registeredDevice.response.status() === 200, 'Teacher device registry did not read back from the protected API.')
    assert(registeredDevice.body?.data?.some((device) => device.id === deviceId && device.classroomId === config.classroomId && device.status === 'offline'), 'Registered device did not persist with the expected classroom and honest offline state.')
    const storedDevice = await deviceRef.get()
    const storedDeviceData = storedDevice.data() ?? {}
    assert(storedDevice.exists && storedDeviceData.ownerTeacherId === teacherUid, 'Device registry did not persist teacher ownership.')
    assert(storedDeviceData.credentialHash === createHash('sha256').update(credentialMatch[1]).digest('hex'), 'Device credential was not stored as the matching SHA-256 hash.')
    assert(!Object.hasOwn(storedDeviceData, 'secret') && !Object.hasOwn(storedDeviceData, 'credential'), 'Device registry persisted a plaintext credential.')

    const invalidHeartbeat = await requestJson(page, config.baseUrl, '/api/device/heartbeat', {
      method: 'POST',
      headers: { 'x-device-id': deviceId, 'x-device-secret': 'invalid-device-secret' },
      data: { battery: 78, signal: 85, firmware: '1.2.3' },
    })
    assert(invalidHeartbeat.response.status() === 401, 'Device heartbeat accepted an invalid device credential.')
    const invalidTelemetry = await requestJson(page, config.baseUrl, '/api/device/heartbeat', {
      method: 'POST',
      headers: { 'x-device-id': deviceId, 'x-device-secret': credentialMatch[1] },
      data: { battery: '78', command: 'unlock' },
    })
    assert(invalidTelemetry.response.status() === 400, 'Device heartbeat accepted coerced telemetry or a non-telemetry command field.')
    const validHeartbeat = await requestJson(page, config.baseUrl, '/api/device/heartbeat', {
      method: 'POST',
      headers: { 'x-device-id': deviceId, 'x-device-secret': credentialMatch[1] },
      data: { battery: 78, signal: 85, firmware: '1.2.3' },
    })
    assert(validHeartbeat.response.status() === 200 && validHeartbeat.body?.data?.accepted === true, 'Valid device heartbeat was not confirmed by the server.')
    const telemetrySnapshot = await deviceRef.get()
    assert(telemetrySnapshot.data()?.battery === 78 && telemetrySnapshot.data()?.signal === 85 && telemetrySnapshot.data()?.firmware === '1.2.3', 'Device heartbeat telemetry did not persist to the owned registry record.')
    await page.reload()
    await page.getByRole('heading', { name: 'Perangkat TuturAI', exact: true }).waitFor()
    await page.getByText(deviceId, { exact: true }).waitFor()
    // The layout also renders a connection badge in the banner, so scope the
    // device status assertion to the page content.
    await page.locator('main').getByText('Online', { exact: true }).waitFor()
    await page.getByText('78%', { exact: true }).waitFor()
    await page.getByText('Firmware 1.2.3', { exact: true }).waitFor()
    const revokedDevice = await requestJson(page, config.baseUrl, `/api/teacher/devices?deviceId=${encodeURIComponent(deviceId)}`, { method: 'DELETE' })
    assert(revokedDevice.response.status() === 200 && revokedDevice.body?.data?.status === 'revoked', 'Teacher device revocation did not confirm on the server.')
    const revokedSnapshot = await deviceRef.get()
    assert(revokedSnapshot.data()?.revokedAt != null && revokedSnapshot.data()?.status === 'offline', 'Revoked device remained active or retained an online status.')

    console.log(JSON.stringify({ suite: 'teacher', status: 'PASS', dashboard: true, studentMonitoring: true, analyticsReadback: true, pdfBytes: reportBytes.byteLength, settingsFirestoreReadback: true, settingsReload: true, leaderboardServerOrdering: true, leaderboardUiReadback: true, deviceRegistrationServerReadback: true, deviceCredentialHashOnly: true, deviceRevocationReadback: true }))
  } finally {
    await closeProdResources(resources, cleanup, config.cleanupAfterRun)
  }
}

async function runAssignment(config) {
  const admin = createAdminClient(config)
  await verifyDedicatedIdentity(admin.auth, admin.db, config.teacher, 'teacher')
  const studentUid = await verifyDedicatedIdentity(admin.auth, admin.db, config.student, 'student')
  await assertClassroomFixture(admin.db, config)
  const resources = attachAdmin(await launchProdBrowser(config), admin)
  const cleanup = []
  const teacherPage = resources.page
  const studentContext = await resources.browser.newContext()
  const studentPage = await studentContext.newPage()
  const assignmentTitle = `${config.testPrefix} Assignment ${randomUUID().slice(0, 8)}`
  let assignmentId = null
  let submissionId = null

  try {
    await loginWithPassword(teacherPage, config, config.teacher, 'teacher')
    await gotoSettled(teacherPage, new URL('/guru/penugasan', config.baseUrl))
    await teacherPage.getByRole('heading', { name: 'Penugasan', exact: true }).waitFor()
    await teacherPage.getByLabel('Classroom').selectOption(config.classroomId)
    await teacherPage.getByLabel('Status saat dibuat').selectOption('published')
    await teacherPage.getByLabel('Judul').fill(assignmentTitle)
    await teacherPage.getByLabel('Instruksi').fill(`${config.testPrefix} durable submission and review fixture.`)
    await teacherPage.getByLabel('Batas pengumpulan').fill(localDateTime(2))
    await teacherPage.getByLabel('Maksimal attempt').fill('2')
    const create = await waitForApiResponse(
      teacherPage,
      `/api/classrooms/${config.classroomId}/assignments`,
      'POST',
      () => teacherPage.getByRole('button', { name: 'Simpan penugasan', exact: true }).click(),
    )
    assert(create.response.status() === 201, `Teacher assignment publish returned ${create.response.status()}.`)
    assignmentId = create.body?.data?.id
    assert(typeof assignmentId === 'string', 'Published assignment has no server ID.')
    const assignmentRef = admin.db.collection('assignments').doc(assignmentId)
    trackCleanupRef(cleanup, assignmentRef)
    const persistedAssignment = await assignmentRef.get()
    assert(persistedAssignment.exists && persistedAssignment.data()?.classId === config.classroomId, 'Assignment did not persist in its classroom.')
    assert(persistedAssignment.data()?.status === 'published' && persistedAssignment.data()?.maxAttempts === 2, 'Published assignment settings did not persist.')

    await loginWithPassword(studentPage, config, config.student, 'student')
    await gotoSettled(studentPage, new URL('/siswa/penugasan', config.baseUrl))
    const studentAssignment = studentPage.getByRole('heading', { name: assignmentTitle, exact: true }).locator('xpath=../..')
    await studentAssignment.waitFor()
    await studentAssignment.getByRole('button', { name: 'Kumpulkan', exact: true }).click()
    await studentPage.getByText('Penugasan terkumpul').waitFor()
    await studentPage.getByText('Status: pending_review').waitFor()
    submissionId = `${assignmentId}_${studentUid}`
    const submissionRef = admin.db.collection('submissions').doc(submissionId)
    trackCleanupRef(cleanup, submissionRef)
    const firstSubmission = await submissionRef.get()
    assert(firstSubmission.exists && firstSubmission.data()?.attempt === 1 && firstSubmission.data()?.isLate === true, 'First submission did not persist attempt and derived late state.')

    await gotoSettled(teacherPage, new URL('/guru/penilaian', config.baseUrl))
    let reviewCard = teacherPage.getByRole('heading', { name: assignmentTitle, exact: true }).locator('xpath=../..')
    await reviewCard.waitFor()
    await reviewCard.getByRole('button', { name: 'Kembalikan' }).click()
    await teacherPage.getByRole('alert').filter({ hasText: 'Feedback wajib' }).waitFor()
    await teacherPage.getByLabel('Umpan Balik Guru').fill(`${config.testPrefix} retry requested`)
    await reviewCard.getByRole('button', { name: 'Kembalikan' }).click()
    await teacherPage.getByText('Tidak ada submission menunggu').waitFor()

    await studentPage.reload()
    await studentPage.getByText('Status: returned').waitFor()
    await studentPage.getByRole('button', { name: 'Kirim ulang' }).click()
    await studentPage.getByText('Status: pending_review').waitFor()

    await teacherPage.reload()
    reviewCard = teacherPage.getByRole('heading', { name: assignmentTitle, exact: true }).locator('xpath=../..')
    await reviewCard.waitFor()
    await reviewCard.getByRole('button', { name: 'Setujui' }).click()
    await teacherPage.getByText('Tidak ada submission menunggu').waitFor()
    await studentPage.reload()
    await studentPage.getByText('Status: approved').waitFor()

    const finalSubmission = await submissionRef.get()
    assert(finalSubmission.data()?.status === 'approved' && finalSubmission.data()?.attempt === 2, 'Submission did not reach approved attempt 2 in Firestore.')
    const overLimit = await studentPage.request.post(new URL(`/api/assignments/${assignmentId}/submit`, config.baseUrl).toString(), {
      headers: { 'Idempotency-Key': `${config.testPrefix}-${randomUUID()}` },
    })
    assert(overLimit.status() === 409, `Approved/max-attempt submission should reject a third attempt, got ${overLimit.status()}.`)
    assert((await submissionRef.get()).data()?.attempt === 2, 'Rejected over-limit attempt mutated the approved submission.')

    console.log(JSON.stringify({ suite: 'assignment', status: 'PASS', dueDateLateDerived: true, returnResubmitApprove: true, attempt: 2, overLimitStatus: overLimit.status() }))
  } finally {
    await studentContext.close()
    await closeProdResources(resources, cleanup, config.cleanupAfterRun)
  }
}

async function runStudent(config) {
  const admin = createAdminClient(config)
  const studentUid = await verifyDedicatedIdentity(admin.auth, admin.db, config.student, 'student')
  await assertClassroomFixture(admin.db, config)
  const resources = attachAdmin(await launchProdBrowser(config), admin)
  const cleanup = []
  const userRef = admin.db.collection('users').doc(studentUid)
  const previousUser = await restoreDocument(cleanup, userRef)
  assert(previousUser, 'Dedicated production student profile disappeared before the E2E run.')
  const startedAt = Date.now()
  const runId = randomUUID().replaceAll('-', '').slice(0, 10)
  const prefix = `000000e2e-${config.testPrefix}-${runId}`
  const questionIds = new Set()
  const page = resources.page
  // Record exactly which activities the production question-bank API served to
  // this student, so persistence is asserted against what was really delivered
  // instead of a hand-counted window arithmetic.
  const servedActivities = new Set()
  // Mirrors `isAnswerableContentType` in @tuturai/domain: conversation and
  // speaking cards are free-text activities that persist to their own
  // collections and are asserted separately below.
  const answerableContentTypes = new Set(['question', 'vocabulary', 'listening', 'test'])
  page.on('response', (response) => {
    const url = new URL(response.url())
    if (url.pathname !== '/api/student/question-bank' || response.request().method() !== 'GET') return
    response.json()
      .then((payload) => {
        for (const item of payload.data ?? []) if (answerableContentTypes.has(item.contentType)) servedActivities.add(item.id)
      })
      .catch(() => {})
  })

  const questionFixtures = [
    { id: `${prefix}-adaptive-vocab`, type: 'vocabulary', skill: 'vocabulary', word: 'adaptive', prompt: 'Review the E2E adaptive vocabulary card.', options: ['mastered'], correctOption: 0 },
    // Every activity page requests a bounded bank window (the question-bank API caps
    // `limit` at 20), so each deterministic fixture group must fill its whole
    // window; otherwise real production cards render without a deterministic
    // correct option and the 100/100 completion score cannot be proven.
    ...Array.from({ length: 20 }, (_, index) => ({
      id: `${prefix}-quiz-${String(index).padStart(2, '0')}`,
      type: 'question',
      skill: 'grammar',
      prompt: `${config.testPrefix} quiz question ${index + 1}: select the correct answer.`,
      options: ['correct', 'incorrect', 'maybe', 'unknown'],
      correctOption: 0,
    })),
    // The listening page requests `?type=listening&limit=20` and the API caps a
    // window at 20 cards, so the deterministic fixture bank must fill the whole
    // window; otherwise real production cards render without a deterministic
    // correct option and the completion score cannot be proven.
    ...Array.from({ length: 20 }, (_, index) => ({
      id: `${prefix}-listening-${String(index).padStart(2, '0')}`,
      type: 'listening',
      skill: 'listening',
      prompt: `${config.testPrefix} listening question ${index + 1}: what did the speaker say?`,
      audioText: 'The correct answer is the first option.',
      options: ['correct', 'incorrect', 'maybe', 'unknown'],
      correctOption: 0,
    })),
    ...Array.from({ length: 20 }, (_, index) => ({
      id: `${prefix}-test-${String(index).padStart(2, '0')}`,
      type: 'test',
      skill: 'grammar',
      prompt: `${config.testPrefix} pedagogical test question ${index + 1}.`,
      options: ['correct', 'incorrect', 'maybe', 'unknown'],
      correctOption: 0,
    })),
    // The vocabulary window is 20 cards and the adaptive fixture sorts first, so
    // this group keeps 19 servable cards to complete that window exactly.
    ...Array.from({ length: 19 }, (_, index) => ({
      id: `${prefix}-vocab-${String(index).padStart(2, '0')}`,
      type: 'vocabulary',
      skill: 'vocabulary',
      word: `${config.testPrefix} word ${index + 1}`,
      meaning: 'kata latihan E2E',
      example: `Use ${config.testPrefix} word ${index + 1} in a sentence.`,
      ipa: `/e2e-${index + 1}/`,
      tip: 'Review the meaning and confirm mastery.',
      prompt: `Review ${config.testPrefix} word ${index + 1}.`,
      options: ['mastered'],
      correctOption: 0,
    })),
    ...Array.from({ length: 10 }, (_, index) => ({
      id: `${prefix}-conversation-${String(index).padStart(2, '0')}`,
      type: 'conversation',
      skill: 'conversation',
      prompt: `${config.testPrefix} conversation ${index + 1}: describe a learning habit.`,
      options: ['text'],
      correctOption: 0,
    })),
  ]

  for (const question of questionFixtures) {
    const reference = admin.db.collection('questionBank').doc(question.id)
    const { id, type, ...content } = question
    await reference.create({
      ...content,
      id,
      contentType: type,
      level: 'beginner',
      explanation: 'Dedicated production E2E fixture.',
      tags: ['e2e', config.testPrefix],
      status: 'published',
      e2eTestPrefix: config.testPrefix,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    questionIds.add(id)
    trackCleanupRef(cleanup, reference)
  }

  trackCleanupAction(cleanup, async () => {
    const attempts = await admin.db.collection('questionAttempts').where('studentId', '==', studentUid).limit(200).get()
    await Promise.all(attempts.docs.filter((doc) => questionIds.has(doc.data().questionId)).map((doc) => doc.ref.delete()))
  })
  trackCleanupAction(cleanup, async () => {
    const attempts = await admin.db.collection('conversationTextAttempts').where('studentId', '==', studentUid).limit(100).get()
    await Promise.all(attempts.docs.filter((doc) => {
      const createdAt = doc.data().createdAt
      const millis = typeof createdAt?.toMillis === 'function' ? createdAt.toMillis() : Date.parse(String(createdAt ?? ''))
      return Number.isFinite(millis) && millis >= startedAt
    }).map((doc) => doc.ref.delete()))
  })

  try {
    await loginWithPassword(page, config, config.student, 'student')
    await page.getByRole('heading', { name: 'Ayo lanjutkan latihan speaking-mu hari ini', exact: true }).waitFor()
    const selectedClassroom = page.getByLabel('Pilih classroom aktif')
    if (await selectedClassroom.count()) await selectedClassroom.selectOption(config.classroomId)

    const adaptiveBefore = await requestJson(page, config.baseUrl, '/api/student/adaptive')
    assert(adaptiveBefore.response.status() === 200, 'Adaptive recommendation API did not return 200.')
    assert(adaptiveBefore.body?.data?.recommendation?.id === questionFixtures[0].id, 'Dedicated adaptive fixture was not the first recommendation for the clean E2E account.')
    await gotoSettled(page, new URL('/siswa/adaptive', config.baseUrl))
    await page.getByRole('heading', { name: 'Adaptive Learning Path', exact: true }).waitFor()
    // The adaptive card renders both a primary "Mulai latihan" CTA and a
    // secondary "Buka materi" CTA pointing at the same activity. Either one
    // navigating to that activity proves the recommendation wiring, so target
    // the shared destination instead of a positional guess about the CTA.
    const adaptiveLink = page.locator(`a[href*="questionId=${encodeURIComponent(questionFixtures[0].id)}"]`).first()
    await adaptiveLink.waitFor()
    await adaptiveLink.click()
    await page.getByRole('heading', { name: 'Vocabulary', exact: true }).waitFor()
    await page.getByText('Memuat bank kosakata...').waitFor({ state: 'detached', timeout: 30_000 })
    // Completing the recommended card is a real production write; wait for the
    // server confirmation before reading the adaptive read model back.
    const masterySaved = await waitForApiResponse(page, '/api/student/question-bank', 'POST', () => page.getByRole('button', { name: 'Sudah hafal', exact: true }).click())
    assert(masterySaved.response.status() === 200 && masterySaved.body?.data?.isCorrect === true, `Adaptive vocabulary mastery returned ${masterySaved.response.status()}.`)
    const adaptiveAfter = await requestJson(page, config.baseUrl, '/api/student/adaptive')
    assert(adaptiveAfter.body?.data?.activities?.find((item) => item.id === questionFixtures[0].id)?.status === 'completed', 'Adaptive completion did not persist to the server read model.')
    assert(adaptiveAfter.body?.data?.recommendation?.id !== questionFixtures[0].id, 'Adaptive recommender repeated a completed activity.')

    async function answerQuestionRound(path, heading) {
      await gotoSettled(page, new URL(path, config.baseUrl))
      await page.getByRole('heading', { name: heading, exact: true }).waitFor()
      let answered = 0
      while (answered < 20) {
        const prompt = page.locator('main h2').last()
        await prompt.waitFor()
        await prompt.locator('xpath=..').getByRole('button').first().click({ timeout: 15_000 })
            .catch((cause) => captureFailureContext(page, cause))
        answered += 1
        const finish = page.getByRole('button', { name: 'Lihat Hasil', exact: true })
        if (await finish.count()) {
          await finish.click()
          await page.getByRole('dialog').getByText('Aktivitas selesai').waitFor({ timeout: 30_000 })
            .catch((cause) => captureFailureContext(page, cause))
          await page.getByRole('dialog').getByText('100/100', { exact: true }).waitFor({ timeout: 30_000 })
            .catch((cause) => captureFailureContext(page, cause))
          return answered
        }
        await page.getByRole('button', { name: 'Soal Berikutnya', exact: true }).click()
      }
      throw new Error('Production learning activity exceeded the 20-item safety bound.')
    }

    const quizCount = await answerQuestionRound('/siswa/quiz', 'Quiz Harian')
    await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click()

    await gotoSettled(page, new URL('/siswa/listening', config.baseUrl))
    await page.getByRole('heading', { name: 'Listening Comprehension', exact: true }).waitFor()
    await page.getByText('Memuat latihan listening...').waitFor({ state: 'detached', timeout: 30_000 })
    const correctOptions = page.getByRole('button', { name: 'correct', exact: true })
    const listeningCount = await correctOptions.count()
    assert(listeningCount >= 10, `Listening test fixture bank returned only ${listeningCount} E2E cards.`)
    for (let index = 0; index < listeningCount; index += 1) await correctOptions.nth(index).click()
    await page.getByRole('button', { name: 'Kumpulkan Jawaban', exact: true }).click()
    await page.getByRole('dialog').getByText('Aktivitas selesai').waitFor()
    await page.getByRole('dialog').getByText('100/100', { exact: true }).waitFor()

    const testCount = await answerQuestionRound('/siswa/tes', 'Tes Pedagogis')
    await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click()

    await gotoSettled(page, new URL(`/siswa/percakapan?questionId=${encodeURIComponent(questionFixtures.find((item) => item.type === 'conversation').id)}`, config.baseUrl))
    await page.getByRole('heading', { name: 'AI Conversation', exact: true }).waitFor()
    await page.getByLabel('Jawaban percakapan').fill(`${config.testPrefix} I practice my learning routine every morning.`)
    await page.getByRole('button', { name: 'Kirim', exact: true }).click()
    await page.getByRole('dialog').getByText('Hasil percakapan sudah dikonfirmasi tersimpan oleh server.').waitFor()

    await gotoSettled(page, new URL('/siswa/vocabulary', config.baseUrl))
    await page.getByRole('heading', { name: 'Vocabulary', exact: true }).waitFor()
    await page.getByText('Memuat bank kosakata...').waitFor({ state: 'detached', timeout: 30_000 })
    const vocabSession = await masterVocabularySession(page)
    const vocabCount = vocabSession.total
    assert(vocabSession.completionMessage === 'Semua kartu kosakata pada sesi ini sudah dikonfirmasi tersimpan.', `Vocabulary session closed without the server-confirmation dialog.`)

    const attemptSnapshot = await admin.db.collection('questionAttempts').where('studentId', '==', studentUid).limit(200).get()
    const e2eAttempts = attemptSnapshot.docs.filter((doc) => questionIds.has(doc.data().questionId))
    // Every activity the production API actually served to this student must
    // have a durable Firestore attempt behind it.
    const servedIds = servedActivities
    const attemptedIds = new Set(e2eAttempts.map((doc) => doc.data().questionId))
    const unattempted = [...servedIds].filter((id) => !attemptedIds.has(id))
    // quiz(10) + listening(20) + test(20) + vocabulary(20) deterministic cards.
    assert(servedIds.size >= 70, `Production only served ${servedIds.size} distinct learning activities.`)
    assert(unattempted.length === 0, `${unattempted.length} served activities did not persist a Firestore attempt: ${JSON.stringify(unattempted.slice(0, 5))}.`)
    const conversationAttempts = await admin.db.collection('conversationTextAttempts').where('studentId', '==', studentUid).limit(100).get()
    const persistedConversation = conversationAttempts.docs.filter((doc) => {
      const createdAt = doc.data().createdAt
      const millis = typeof createdAt?.toMillis === 'function' ? createdAt.toMillis() : Date.parse(String(createdAt ?? ''))
      return Number.isFinite(millis) && millis >= startedAt
    })
    assert(persistedConversation.length === 1, 'Conversation text completion did not persist exactly once.')

    const learningStats = await requestJson(page, config.baseUrl, '/api/student/learning-stats')
    assert(learningStats.response.status() === 200, 'Student learning progress did not read back from the server.')
    assert(learningStats.body?.data?.summary?.totalAttempts >= e2eAttempts.length, 'Student progress summary omitted persisted production attempts.')
    const scholarAchievement = learningStats.body?.data?.achievements?.find((achievement) => achievement.id === 'scholar')
    assert(scholarAchievement?.unlocked === true, 'Completed E2E learning activities did not unlock the persisted 25-practice achievement.')
    const achievementProfile = await userRef.get()
    assert(achievementProfile.data()?.achievementIds?.includes('scholar'), 'Achievement unlock did not persist in the student profile.')
    await gotoSettled(page, new URL('/siswa/achievements', config.baseUrl))
    await page.getByRole('heading', { name: 'Pencapaian', exact: true }).waitFor()
    const scholarCard = page.getByText('Pembelajar Aktif', { exact: true }).locator('xpath=../..')
    await scholarCard.getByText('Terbuka', { exact: true }).waitFor()
    await page.reload()
    const persistedScholarCard = page.getByText('Pembelajar Aktif', { exact: true }).locator('xpath=../..')
    await persistedScholarCard.getByText('Terbuka', { exact: true }).waitFor()

    await gotoSettled(page, new URL('/siswa/progress', config.baseUrl))
    await page.getByRole('heading', { name: 'Progress Belajar', exact: true }).waitFor()
    await page.getByText('Total Latihan', { exact: true }).waitFor()
    await page.reload()
    await page.getByRole('heading', { name: 'Progress Belajar', exact: true }).waitFor()

    const leaderboardData = await requestJson(page, config.baseUrl, `/api/student/dashboard?classroomId=${encodeURIComponent(config.classroomId)}`)
    assert(leaderboardData.response.status() === 200 && Array.isArray(leaderboardData.body?.data?.leaderboard), 'Leaderboard did not come from the protected server API.')
    const leaderboardRows = leaderboardData.body.data.leaderboard
    const ownRank = leaderboardRows.find((row) => row.studentId === studentUid)
    assert(ownRank && Number.isInteger(ownRank.rank) && ownRank.rank > 0, 'Leaderboard did not include the dedicated student with a server rank.')
    assert(leaderboardRows.every((row, index) => row.rank === index + 1 && (index === 0 || leaderboardRows[index - 1].xp >= row.xp)), 'Leaderboard ranks were not ordered by persisted XP.')
    await gotoSettled(page, new URL('/siswa/leaderboard', config.baseUrl))
    await page.getByRole('heading', { name: 'Leaderboard', exact: true }).waitFor()
    const ownMarker = page.getByText('(Kamu)', { exact: true })
    await ownMarker.waitFor()
    const ownRow = ownMarker.locator('xpath=../../..')
    assert(Number(await ownRow.locator('span').first().innerText()) === ownRank.rank, 'Leaderboard UI did not render the server-backed student rank.')
    await page.reload()
    await page.getByRole('heading', { name: 'Leaderboard', exact: true }).waitFor()

    const updatedDisplayName = `${config.testPrefix} Student ${runId}`
    const updatedSchool = `${config.testPrefix} School ${runId}`
    await gotoSettled(page, new URL('/siswa/profil', config.baseUrl))
    await page.getByRole('heading', { name: 'Profil & Pengaturan', exact: true }).waitFor()
    await page.getByLabel('Nama lengkap').fill(updatedDisplayName)
    await page.getByLabel('Sekolah').fill(updatedSchool)
    const profileUpdate = await waitForApiResponse(page, '/api/me', 'PATCH', () => page.getByRole('button', { name: 'Simpan profil', exact: true }).click())
    assert(profileUpdate.response.status() === 200, `Student profile update returned ${profileUpdate.response.status()}.`)
    assert(profileUpdate.body?.data?.profile?.full_name === updatedDisplayName && profileUpdate.body?.data?.profile?.school === updatedSchool, 'Profile update response did not read back the saved fields.')
    const profileReadback = await requestJson(page, config.baseUrl, '/api/me')
    assert(profileReadback.response.status() === 200 && profileReadback.body?.data?.profile?.full_name === updatedDisplayName && profileReadback.body?.data?.profile?.school === updatedSchool, 'Student profile API read-back did not match the submitted fields.')
    const storedProfile = await userRef.get()
    assert(storedProfile.data()?.displayName === updatedDisplayName && storedProfile.data()?.school === updatedSchool && storedProfile.data()?.role === 'student', 'Student profile fields did not persist without changing the permanent role.')
    await page.reload()
    await page.getByRole('heading', { name: 'Profil & Pengaturan', exact: true }).waitFor()
    const restoredName = await waitForInputValue(page.getByLabel('Nama lengkap'), updatedDisplayName, 'Student profile name')
    const restoredSchool = await waitForInputValue(page.getByLabel('Sekolah'), updatedSchool, 'Student school')
    assert(restoredName === updatedDisplayName && restoredSchool === updatedSchool, 'Student profile name did not restore after reload.')
    assert(await page.getByLabel('Sekolah').inputValue() === updatedSchool, 'Student profile school did not restore after reload.')

    console.log(JSON.stringify({ suite: 'student', status: 'PASS', adaptiveNoRepeat: true, quizAttempts: quizCount, listeningCards: listeningCount, testAttempts: testCount, vocabularyCards: vocabCount, conversationReadback: true, achievementActionReadback: true, profileMutationReadback: true, progressReload: true, leaderboardApiAndUiRank: ownRank.rank, leaderboardReload: true, firestoreAttempts: e2eAttempts.length }))
  } finally {
    await closeProdResources(resources, cleanup, config.cleanupAfterRun)
  }
}

async function runDrive(config) {
  const admin = createAdminClient(config)
  const teacherUid = await verifyDedicatedIdentity(admin.auth, admin.db, config.teacher, 'teacher')
  const studentUid = await verifyDedicatedIdentity(admin.auth, admin.db, config.student, 'student')
  await assertClassroomFixture(admin.db, config)
  const resources = attachAdmin(await launchProdBrowser(config), admin)
  const cleanup = []
  await restoreDocument(cleanup, admin.db.collection('apiRateLimits').doc(createHash('sha256').update(`drive-oauth:${teacherUid}`).digest('hex')))
  await restoreDocument(cleanup, admin.db.collection('apiRateLimits').doc(createHash('sha256').update(`drive-upload:${teacherUid}`).digest('hex')))
  await restoreDocument(cleanup, admin.db.collection('apiRateLimits').doc(createHash('sha256').update(`drive-upload:${studentUid}`).digest('hex')))
  const studentContext = await resources.browser.newContext()
  const studentPage = await studentContext.newPage()
  const teacherPage = resources.page
  const fixtureBytes = await readFile(config.fixtures.drive)
  const fixtureMimeType = driveMimeType(config.fixtures.drive)
  const extension = extname(config.fixtures.drive).toLowerCase()
  const runId = randomUUID().replaceAll('-', '').slice(0, 10)
  const assignmentTitle = `${config.testPrefix} Drive ${runId}`
  const teacherFileName = safeDriveName(`${config.testPrefix}-assignment-${runId}${extension}`)
  const studentFileName = safeDriveName(`${config.testPrefix}-submission-${runId}${extension}`)
  let assignmentId = null
  let submissionId = null
  let teacherUploadKey = null
  let studentUploadKey = null
  let studentSubmitKey = null
  let teacherFileId = null
  let studentFileId = null

  try {
    await loginWithPassword(teacherPage, config, config.teacher, 'teacher')
    const initialConnection = await requestJson(teacherPage, config.baseUrl, '/api/integrations/google-drive/status', {}, 'google-drive')
    assert(initialConnection.response.status() === 200, 'Teacher Google Drive status endpoint failed.')
    await ensureDriveConnected(teacherPage, config)
    await gotoSettled(teacherPage, new URL('/guru/penugasan', config.baseUrl))
    await teacherPage.getByRole('heading', { name: 'Penugasan', exact: true }).waitFor()
    await teacherPage.getByLabel('Classroom').selectOption(config.classroomId)
    await teacherPage.getByLabel('Status saat dibuat').selectOption('published')
    await teacherPage.getByLabel('Judul').fill(assignmentTitle)
    await teacherPage.getByLabel('Instruksi').fill(`${config.testPrefix} Drive attachment and student submission.`)
    await teacherPage.getByLabel('Maksimal attempt').fill('2')
    await teacherPage.locator('input[type=file]').first().setInputFiles({ name: teacherFileName, mimeType: fixtureMimeType, buffer: fixtureBytes })

    const uploadResponsePromise = teacherPage.waitForResponse((response) => (
      new URL(response.url()).pathname === '/api/integrations/google-drive/upload'
      && response.request().method() === 'POST'
    ), { timeout: 120_000 })
    const created = await waitForApiResponse(
      teacherPage,
      `/api/classrooms/${encodeURIComponent(config.classroomId)}/assignments`,
      'POST',
      () => teacherPage.getByRole('button', { name: 'Simpan penugasan', exact: true }).click(),
    )
    assert(created.response.status() === 201, `Teacher assignment creation returned ${created.response.status()}.`)
    assignmentId = created.body?.data?.id
    assert(typeof assignmentId === 'string', 'Drive E2E assignment did not return a server ID.')
    const assignmentRef = admin.db.collection('assignments').doc(assignmentId)
    trackCleanupRef(cleanup, assignmentRef)
    await assignmentRef.update({ e2eTestPrefix: config.testPrefix })
    teacherUploadKey = createHash('sha256')
      .update(teacherUid).update('\0').update(assignmentId).update('\0').update(teacherFileName).update('\0').update(fixtureBytes)
      .digest('hex')
    trackCleanupAction(cleanup, async () => {
      if (!assignmentId || !teacherUploadKey) return
      const fileId = teacherFileId ?? await operationFileId(admin.db, teacherUid, teacherUploadKey)
      if (fileId) await cleanupDriveFile(teacherPage, config, { assignmentId, fileId }, teacherUploadKey)
    })

    const uploadResponse = await uploadResponsePromise
    const teacherUpload = await uploadResponse.json().catch(() => null)
    assert(uploadResponse.status() === 201 && typeof teacherUpload?.data?.file?.id === 'string', `Teacher Drive attachment upload returned ${uploadResponse.status()}.`)
    teacherFileId = teacherUpload.data.file.id
    logProdE2ERequest({ requestId: uploadResponse.headers()['x-request-id'] ?? null, route: '/api/integrations/google-drive/upload', status: uploadResponse.status(), errorCode: null, provider: 'google-drive', durationMs: 0 })
    const persistedAssignment = await assignmentRef.get()
    assert(persistedAssignment.exists && persistedAssignment.data()?.status === 'published', 'Assignment was not published after its Drive attachment completed.')
    assert(persistedAssignment.data()?.attachments?.filter((file) => file.id === teacherFileId).length === 1, 'Drive attachment did not persist exactly once in Firestore.')
    await teacherPage.getByRole('link', { name: teacherFileName, exact: true }).waitFor()

    const duplicateTeacherUpload = await requestJson(teacherPage, config.baseUrl, '/api/integrations/google-drive/upload', {
      method: 'POST',
      headers: { 'Idempotency-Key': teacherUploadKey },
      multipart: { assignmentId, file: { name: teacherFileName, mimeType: fixtureMimeType, buffer: fixtureBytes } },
    }, 'google-drive')
    assert(duplicateTeacherUpload.response.status() === 201 && duplicateTeacherUpload.body?.data?.file?.id === teacherFileId, 'Teacher Drive upload retry did not replay the same provider file.')
    assert((await assignmentRef.get()).data()?.attachments?.filter((file) => file.id === teacherFileId).length === 1, 'Teacher Drive upload retry duplicated assignment metadata.')

    await loginWithPassword(studentPage, config, config.student, 'student')
    await gotoSettled(studentPage, new URL('/siswa', config.baseUrl))
    const classSelector = studentPage.getByLabel('Pilih classroom aktif')
    if (await classSelector.count()) await classSelector.selectOption(config.classroomId)
    await gotoSettled(studentPage, new URL('/siswa/penugasan', config.baseUrl))
    const assignmentCard = studentPage.getByRole('heading', { name: assignmentTitle, exact: true }).locator('xpath=../..')
    await assignmentCard.waitFor()
    await assignmentCard.locator('input[type=file]').setInputFiles({ name: studentFileName, mimeType: fixtureMimeType, buffer: fixtureBytes })
    submissionId = `${assignmentId}_${studentUid}`
    const submissionRef = admin.db.collection('submissions').doc(submissionId)
    trackCleanupRef(cleanup, submissionRef)
    studentPage.on('request', (request) => {
      if (new URL(request.url()).pathname === `/api/assignments/${assignmentId}/submit` && request.method() === 'POST') {
        studentSubmitKey = request.headers()['idempotency-key'] ?? null
        if (studentSubmitKey) {
          studentUploadKey = createHash('sha256').update(studentUid).update('\0').update(assignmentId).update('\0').update(studentSubmitKey).digest('hex')
        }
      }
    })
    trackCleanupAction(cleanup, async () => {
      if (!assignmentId || !submissionId || !studentUploadKey) return
      const fileId = studentFileId ?? await operationFileId(admin.db, teacherUid, studentUploadKey)
      if (fileId) await cleanupDriveFile(teacherPage, config, { assignmentId, submissionId, fileId }, studentUploadKey)
    })
    const submissionResult = await waitForApiResponse(
      studentPage,
      `/api/assignments/${encodeURIComponent(assignmentId)}/submit`,
      'POST',
      () => assignmentCard.getByRole('button', { name: 'Kumpulkan', exact: true }).click(),
      'google-drive',
    )
    assert(submissionResult.response.status() === 201, `Student Drive submission returned ${submissionResult.response.status()}.`)
    assert(typeof studentSubmitKey === 'string' && studentSubmitKey.length >= 8, 'Student submission did not send a stable idempotency key.')
    studentFileId = submissionResult.body?.data?.files?.[0]?.id
    assert(typeof studentFileId === 'string', 'Student submission response did not confirm a Drive file ID.')
    const persistedSubmission = await submissionRef.get()
    assert(persistedSubmission.exists && persistedSubmission.data()?.status === 'pending_review', 'Student submission was not persisted for teacher review.')
    assert(persistedSubmission.data()?.files?.filter((file) => file.id === studentFileId).length === 1, 'Student Drive file metadata did not persist exactly once.')
    await studentPage.getByRole('link', { name: studentFileName, exact: true }).waitFor()
    const submissionReadback = await requestJson(studentPage, config.baseUrl, `/api/assignments/${encodeURIComponent(assignmentId)}/submission`)
    assert(submissionReadback.response.status() === 200 && submissionReadback.body?.data?.files?.[0]?.id === studentFileId, 'Student submission file did not read back through its protected API.')

    const replay = await requestJson(studentPage, config.baseUrl, `/api/assignments/${encodeURIComponent(assignmentId)}/submit`, {
      method: 'POST',
      headers: { 'Idempotency-Key': studentSubmitKey },
      multipart: { file: { name: studentFileName, mimeType: fixtureMimeType, buffer: fixtureBytes } },
    }, 'google-drive')
    assert(replay.response.status() === 201 && replay.body?.data?.files?.[0]?.id === studentFileId, 'Student file retry did not replay the same Drive object.')
    const replayedSubmission = await submissionRef.get()
    assert(replayedSubmission.data()?.attempt === 1 && replayedSubmission.data()?.files?.filter((file) => file.id === studentFileId).length === 1, 'Duplicate reconnect changed the attempt or duplicated the Drive file metadata.')
    await studentPage.reload()
    await studentPage.getByText('Status: pending_review · Attempt 1', { exact: true }).waitFor()
    await studentPage.getByRole('link', { name: studentFileName, exact: true }).waitFor()

    await cleanupTrackedDocuments(cleanup)
    cleanup.length = 0
    const disconnected = await requestJson(teacherPage, config.baseUrl, '/api/integrations/google-drive/disconnect', { method: 'POST' }, 'google-drive')
    assert(disconnected.response.status() === 200 && disconnected.body?.data?.connected === false, 'Teacher Drive disconnect was not confirmed.')
    const disconnectedStatus = await requestJson(teacherPage, config.baseUrl, '/api/integrations/google-drive/status', {}, 'google-drive')
    assert(disconnectedStatus.response.status() === 200 && disconnectedStatus.body?.data?.connected === false, 'Drive status did not read back after disconnect.')
    await ensureDriveConnected(teacherPage, config)

    console.log(JSON.stringify({ suite: 'drive', status: 'PASS', driveFileIdConfirmed: true, assignmentMetadataReadback: true, submissionMetadataReadback: true, idempotentReplays: true, disconnectReconnect: true, cleanup: 'confirmed' }))
  } finally {
    await studentContext.close()
    await closeProdResources(resources, cleanup, config.cleanupAfterRun)
  }
}

async function runOffline(config) {
  const admin = createAdminClient(config)
  const teacherUid = await verifyDedicatedIdentity(admin.auth, admin.db, config.teacher, 'teacher')
  const studentUid = await verifyDedicatedIdentity(admin.auth, admin.db, config.student, 'student')
  await assertClassroomFixture(admin.db, config)
  const resources = attachAdmin(await launchProdBrowser(config, {
    args: ['--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${config.fixtures.audio}`],
    permissions: ['microphone'],
  }), admin)
  const cleanup = []
  await restoreDocument(cleanup, admin.db.collection('apiRateLimits').doc(createHash('sha256').update(`drive-oauth:${teacherUid}`).digest('hex')))
  await restoreDocument(cleanup, admin.db.collection('apiRateLimits').doc(createHash('sha256').update(`drive-upload:${studentUid}`).digest('hex')))
  await restoreDocument(cleanup, admin.db.collection('apiRateLimits').doc(createHash('sha256').update(`student-assessment:${studentUid}`).digest('hex')))
  const studentContext = await resources.browser.newContext({ permissions: ['microphone'] })
  const teacherPage = resources.page
  const studentPage = await studentContext.newPage()
  const fileBytes = await readFile(config.fixtures.drive)
  const mimeType = driveMimeType(config.fixtures.drive)
  const extension = extname(config.fixtures.drive).toLowerCase()
  const runId = randomUUID().replaceAll('-', '').slice(0, 10)
  const assignmentTitle = `${config.testPrefix} Offline ${runId}`
  const fileName = safeDriveName(`${config.testPrefix}-offline-submission-${runId}${extension}`)
  const startedAt = Date.now()
  let assignmentId = null
  let submissionId = null
  let submissionIdempotencyKey = null
  let driveUploadKey = null
  let submissionFileId = null
  let audioSessionId = null
  let audioQuestionId = null

  try {
    await loginWithPassword(teacherPage, config, config.teacher, 'teacher')
    await ensureDriveConnected(teacherPage, config)
    await gotoSettled(teacherPage, new URL('/guru/penugasan', config.baseUrl))
    await teacherPage.getByLabel('Classroom').selectOption(config.classroomId)
    await teacherPage.getByLabel('Status saat dibuat').selectOption('published')
    await teacherPage.getByLabel('Judul').fill(assignmentTitle)
    await teacherPage.getByLabel('Instruksi').fill(`${config.testPrefix} offline file replay fixture.`)
    await teacherPage.getByLabel('Maksimal attempt').fill('2')
    const created = await waitForApiResponse(
      teacherPage,
      `/api/classrooms/${encodeURIComponent(config.classroomId)}/assignments`,
      'POST',
      () => teacherPage.getByRole('button', { name: 'Simpan penugasan', exact: true }).click(),
    )
    assert(created.response.status() === 201, `Offline assignment creation returned ${created.response.status()}.`)
    assignmentId = created.body?.data?.id
    assert(typeof assignmentId === 'string', 'Offline assignment did not return a server ID.')
    const assignmentRef = admin.db.collection('assignments').doc(assignmentId)
    await assignmentRef.update({ e2eTestPrefix: config.testPrefix })
    trackCleanupRef(cleanup, assignmentRef)

    await loginWithPassword(studentPage, config, config.student, 'student')
    await gotoSettled(studentPage, new URL('/siswa', config.baseUrl))
    const classSelector = studentPage.getByLabel('Pilih classroom aktif')
    if (await classSelector.count()) await classSelector.selectOption(config.classroomId)
    await gotoSettled(studentPage, new URL('/siswa/penugasan', config.baseUrl))
    const assignmentCard = studentPage.getByRole('heading', { name: assignmentTitle, exact: true }).locator('xpath=../..')
    await assignmentCard.waitFor()
    await assignmentCard.locator('input[type=file]').setInputFiles({ name: fileName, mimeType, buffer: fileBytes })
    submissionId = `${assignmentId}_${studentUid}`
    const submissionRef = admin.db.collection('submissions').doc(submissionId)
    trackCleanupRef(cleanup, submissionRef)
    studentPage.on('request', (request) => {
      if (new URL(request.url()).pathname === `/api/assignments/${assignmentId}/submit` && request.method() === 'POST') {
        submissionIdempotencyKey = request.headers()['idempotency-key'] ?? null
        if (submissionIdempotencyKey) {
          driveUploadKey = createHash('sha256').update(studentUid).update('\0').update(assignmentId).update('\0').update(submissionIdempotencyKey).digest('hex')
        }
      }
    })
    trackCleanupAction(cleanup, async () => {
      if (!assignmentId || !submissionId || !driveUploadKey) return
      const fileId = submissionFileId ?? await operationFileId(admin.db, teacherUid, driveUploadKey)
      if (fileId) await cleanupDriveFile(teacherPage, config, { assignmentId, submissionId, fileId }, driveUploadKey)
    })

    await studentContext.setOffline(true)
    await assignmentCard.getByRole('button', { name: 'Kumpulkan', exact: true }).click()
    await studentPage.getByRole('alert').filter({ hasText: 'disimpan di antrean offline' }).waitFor()
    const queuedFile = await readOfflineMutationState(studentPage, 'submit-assignment')
    assert(queuedFile.status === 'pending' && queuedFile.fileName === fileName && queuedFile.fileSize === fileBytes.byteLength, 'Offline assignment action did not retain the exact file payload and idempotency key.')
    await studentPage.getByText('1 menunggu dikirim', { exact: true }).waitFor()

    const fileReplayResponsePromise = studentPage.waitForResponse((response) => (
      new URL(response.url()).pathname === `/api/assignments/${assignmentId}/submit`
      && response.request().method() === 'POST'
    ), { timeout: 120_000 })
    await studentContext.setOffline(false)
    const fileReplayResponse = await fileReplayResponsePromise
    const fileReplayBody = await fileReplayResponse.json().catch(() => null)
    assert(fileReplayResponse.status() === 201 && typeof fileReplayBody?.data?.files?.[0]?.id === 'string', `Offline Drive file replay returned ${fileReplayResponse.status()}.`)
    submissionFileId = fileReplayBody.data.files[0].id
    const syncedFileMutation = await waitForOfflineMutation(studentPage, 'submit-assignment', 'synced')
    assert(syncedFileMutation.fileSize === 0, 'Server-confirmed file replay retained its local Blob payload.')
    const persistedSubmission = await submissionRef.get()
    assert(persistedSubmission.exists && persistedSubmission.data()?.attempt === 1, 'Offline Drive replay did not persist exactly one submission attempt.')
    assert(persistedSubmission.data()?.files?.filter((file) => file.id === submissionFileId).length === 1, 'Offline Drive replay did not persist the exact attachment once.')
    await studentPage.reload()
    await studentPage.getByText('Status: pending_review · Attempt 1', { exact: true }).waitFor()
    await studentPage.getByRole('link', { name: fileName, exact: true }).waitFor()
    await studentPage.getByText('0 menunggu dikirim', { exact: true }).waitFor()

    const duplicateReplay = await requestJson(studentPage, config.baseUrl, `/api/assignments/${encodeURIComponent(assignmentId)}/submit`, {
      method: 'POST',
      headers: { 'Idempotency-Key': syncedFileMutation.idempotencyKey },
      multipart: { file: { name: fileName, mimeType, buffer: fileBytes } },
    }, 'google-drive')
    assert(duplicateReplay.response.status() === 201 && duplicateReplay.body?.data?.files?.[0]?.id === submissionFileId, 'Repeated offline reconnect did not replay the same provider file.')
    const deduplicatedSubmission = await submissionRef.get()
    assert(deduplicatedSubmission.data()?.attempt === 1 && deduplicatedSubmission.data()?.files?.filter((file) => file.id === submissionFileId).length === 1, 'Repeated offline replay duplicated durable assignment state.')

    audioQuestionId = `000000e2e-${config.testPrefix}-${runId}-conversation`
    const questionRef = admin.db.collection('questionBank').doc(audioQuestionId)
    trackCleanupRef(cleanup, questionRef)
    const prompt = `Say: ${config.expectedText}`
    await questionRef.create({ id: audioQuestionId, contentType: 'conversation', skill: 'speaking', level: 'beginner', prompt, options: [], explanation: 'Dedicated offline audio E2E fixture.', tags: ['e2e', config.testPrefix], status: 'published', e2eTestPrefix: config.testPrefix, createdAt: new Date(), updatedAt: new Date() })
    await studentPage.goto(new URL(`/siswa/percakapan?questionId=${encodeURIComponent(audioQuestionId)}`, config.baseUrl).toString())
    await studentPage.getByRole('heading', { name: 'AI Conversation', exact: true }).waitFor()
    await studentPage.getByText(prompt, { exact: true }).waitFor()

    const textAnswer = `${config.testPrefix} I practice speaking every morning for my class.`
    await studentContext.setOffline(true)
    await studentPage.getByLabel('Jawaban percakapan').fill(textAnswer)
    await studentPage.getByRole('button', { name: 'Kirim', exact: true }).click()
    await studentPage.getByText('Jawaban disimpan di antrean offline dan akan dinilai saat koneksi kembali.', { exact: true }).waitFor()
    const queuedText = await readOfflineMutationState(studentPage, 'conversation-text')
    assert(queuedText.status === 'pending' && queuedText.idempotencyKey && queuedText.attemptId === queuedText.idempotencyKey && queuedText.questionId === audioQuestionId && queuedText.sessionId, 'Offline conversation text did not persist its exact request with a stable idempotency key.')
    const textAttemptRef = trackCleanupRef(cleanup, admin.db.collection('conversationTextAttempts').doc(`${studentUid}_${queuedText.idempotencyKey}`))
    const textReplayPromise = studentPage.waitForResponse((response) => (
      new URL(response.url()).pathname === '/api/student/conversation-text'
      && response.request().method() === 'POST'
    ), { timeout: 120_000 })
    await studentContext.setOffline(false)
    const textReplayResponse = await textReplayPromise
    const textReplayBody = await textReplayResponse.json().catch(() => null)
    assert(textReplayResponse.status() === 201 && textReplayBody?.data?.attemptId === queuedText.idempotencyKey && textReplayBody?.data?.answer === textAnswer, `Offline conversation text replay returned ${textReplayResponse.status()} or mismatched its queued payload.`)
    const syncedTextMutation = await waitForOfflineMutation(studentPage, 'conversation-text', 'synced')
    assert(syncedTextMutation.idempotencyKey === queuedText.idempotencyKey, 'Offline conversation text replay changed its idempotency key.')
    const persistedTextAttempt = await textAttemptRef.get()
    assert(persistedTextAttempt.exists && persistedTextAttempt.data()?.answer === textAnswer && persistedTextAttempt.data()?.studentId === studentUid, 'Offline conversation text did not persist and read back from Firestore.')
    const duplicateTextReplay = await requestJson(studentPage, config.baseUrl, '/api/student/conversation-text', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': queuedText.idempotencyKey },
      data: { questionId: queuedText.questionId, attemptId: queuedText.attemptId, sessionId: queuedText.sessionId, answer: textAnswer },
    })
    assert(duplicateTextReplay.response.status() === 201 && duplicateTextReplay.body?.data?.id === persistedTextAttempt.id, 'Repeated offline conversation replay did not return the original durable attempt.')
    const textAttempts = await admin.db.collection('conversationTextAttempts').where('studentId', '==', studentUid).where('questionId', '==', audioQuestionId).limit(10).get()
    assert(textAttempts.size === 1, 'Repeated offline conversation replay created duplicate durable attempts.')

    await studentContext.setOffline(true)
    await studentPage.getByRole('button', { name: 'Rekam suara' }).click()
    await studentPage.getByRole('button', { name: 'Hentikan rekaman' }).waitFor({ timeout: 15_000 })
    await studentPage.getByText('00:02', { exact: true }).waitFor({ timeout: 15_000 })
    await studentPage.getByRole('button', { name: 'Hentikan rekaman' }).click()
    await studentPage.getByText('Audio disimpan di antrean offline dan akan dinilai saat koneksi kembali.').waitFor()
    const queuedAudio = await readOfflineMutationState(studentPage, 'assessment-audio')
    assert(queuedAudio.status === 'pending' && queuedAudio.audioSize > 0 && queuedAudio.sessionId === queuedAudio.idempotencyKey, 'Offline speaking action did not retain an idempotent audio queue entry.')
    assert(queuedAudio.audioQueue.some((entry) => entry.id === queuedAudio.sessionId && entry.size > 0), 'Offline speaking audio Blob was not retained.')
    audioSessionId = queuedAudio.sessionId
    const assessmentRef = admin.db.collection('assessments').doc(`${studentUid}_${audioSessionId}`)
    trackCleanupRef(cleanup, assessmentRef)
    await studentPage.getByText('1 menunggu dikirim', { exact: true }).waitFor()

    const audioReplayPromise = studentPage.waitForResponse((response) => (
      new URL(response.url()).pathname === '/api/student/assessment'
      && response.request().method() === 'POST'
    ), { timeout: 120_000 })
    await studentContext.setOffline(false)
    const audioResponse = await audioReplayPromise
    const audioPayload = await audioResponse.json().catch(() => null)
    assert(audioResponse.status() === 200 && audioPayload?.data?.sessionId === audioSessionId, `Offline audio provider replay returned ${audioResponse.status()}.`)
    for (const dimension of ['pronunciation', 'fluency', 'intonation', 'grammar', 'vocabulary', 'overall']) {
      assert(typeof audioPayload.data[dimension] === 'number', `Offline speaking replay returned no provider-confirmed ${dimension} score.`)
    }
    assert(typeof audioPayload.data.transcript === 'string' && audioPayload.data.transcript.length > 0, 'Offline speaking replay returned no transcript.')
    assert(typeof audioPayload.data.feedback === 'string' && audioPayload.data.feedback.length > 0, 'Offline speaking replay returned no feedback.')
    const syncedAudioMutation = await waitForOfflineMutation(studentPage, 'assessment-audio', 'synced')
    assert(syncedAudioMutation.audioSize === 0 && !syncedAudioMutation.audioQueue.some((entry) => entry.id === audioSessionId), 'Server-confirmed speaking replay did not remove temporary local audio.')
    const persistedAssessment = await assessmentRef.get()
    assert(persistedAssessment.exists && persistedAssessment.data()?.transcript === audioPayload.data.transcript && persistedAssessment.data()?.overall === audioPayload.data.overall, 'Offline speaking assessment did not read back from Firestore.')
    const readback = await requestJson(studentPage, config.baseUrl, `/api/student/assessment?sessionId=${encodeURIComponent(audioSessionId)}`)
    assert(readback.response.status() === 200 && readback.body?.data?.id === audioPayload.data.id, 'Offline speaking assessment did not read back through the authenticated server API.')
    await studentPage.getByRole('dialog').getByText('Aktivitas selesai').waitFor()
    await studentPage.getByText(`Skor percakapan: ${audioPayload.data.overall}/100. ${audioPayload.data.feedback}`, { exact: true }).waitFor()
    await studentPage.getByText('0 menunggu dikirim', { exact: true }).waitFor()

    console.log(JSON.stringify({ suite: 'offline', status: 'PASS', driveFileQueuedSyncedReadback: true, driveReplayExactlyOnce: true, conversationTextQueuedSyncedReadback: true, conversationTextReplayExactlyOnce: true, audioProviderConfirmed: true, audioAssessmentReadback: true, localPayloadCleanup: true, finalUiUpdated: true, e2ePrefix: config.testPrefix }))
  } finally {
    await studentContext.close()
    await closeProdResources(resources, cleanup, config.cleanupAfterRun)
  }
}

async function runSpeaking(config) {
  const admin = createAdminClient(config)
  const studentUid = await verifyDedicatedIdentity(admin.auth, admin.db, config.student, 'student')
  await assertClassroomFixture(admin.db, config)
  const resources = attachAdmin(await launchProdBrowser(config, {
    args: ['--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${config.fixtures.audio}`],
    permissions: ['microphone'],
  }), admin)
  const cleanup = []
  await restoreDocument(cleanup, admin.db.collection('apiRateLimits').doc(createHash('sha256').update(`student-assessment:${studentUid}`).digest('hex')))
  const runId = randomUUID().replaceAll('-', '').slice(0, 10)
  const questionId = `000000e2e-${config.testPrefix}-${runId}-speaking`
  const questionRef = admin.db.collection('questionBank').doc(questionId)
  trackCleanupRef(cleanup, questionRef)
  trackCleanupAction(cleanup, async () => {
    const assessments = await admin.db.collection('assessments').where('studentId', '==', studentUid).limit(200).get()
    await Promise.all(assessments.docs.filter((doc) => doc.data().questionId === questionId).map((doc) => doc.ref.delete()))
  })
  const topic = `${config.testPrefix} speaking topic`
  await questionRef.create({
    id: questionId,
    contentType: 'speaking',
    skill: 'speaking',
    level: 'beginner',
    word: topic,
    prompt: `Speak about ${topic}.`,
    options: [],
    correctOption: 0,
    explanation: 'Dedicated production E2E speaking fixture.',
    tags: ['e2e', config.testPrefix],
    status: 'published',
    e2eTestPrefix: config.testPrefix,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  const page = resources.page
  try {
    await loginWithPassword(page, config, config.student, 'student')
    await page.goto(new URL(`/siswa/speaking?questionId=${encodeURIComponent(questionId)}`, config.baseUrl).toString())
    await page.getByRole('heading', { name: 'Speaking Practice', exact: true }).waitFor()
    await page.getByText(topic, { exact: true }).first().waitFor()
    await page.getByRole('button', { name: 'Mulai rekaman' }).click()
    await page.getByText('Sedang merekam… tekan untuk berhenti', { exact: true }).waitFor({ timeout: 15_000 })
    await page.getByText('00:02', { exact: true }).waitFor({ timeout: 15_000 })
    const assessmentResponsePromise = waitForApiResponse(
      page,
      '/api/student/assessment',
      'POST',
      () => page.getByRole('button', { name: 'Hentikan rekaman' }).click(),
      'stt+assessment',
    )
    const { response, body } = await assessmentResponsePromise
    assert(response.status() === 200, `Speaking provider returned ${response.status()}.`)
    const assessment = body?.data
    assert(assessment?.questionId === questionId && assessment?.studentId === studentUid, 'Speaking response does not match the E2E student/topic.')
    for (const key of ['pronunciation', 'fluency', 'intonation', 'grammar', 'vocabulary', 'overall']) {
      assert(typeof assessment[key] === 'number' && assessment[key] >= 0 && assessment[key] <= 100, `Speaking response has no valid ${key} score.`)
    }
    assert(typeof assessment.transcript === 'string' && assessment.transcript.trim().length > 0, 'Speaking response contains no provider transcript.')
    assert(typeof assessment.feedback === 'string' && assessment.feedback.trim().length > 0, 'Speaking response contains no provider feedback.')
    assert(assessment.confidence === null || (typeof assessment.confidence === 'number' && assessment.confidence >= 0 && assessment.confidence <= 1), 'Speaking confidence is invalid.')
    const stored = await admin.db.collection('assessments').doc(`${studentUid}_${assessment.sessionId}`).get()
    assert(stored.exists && stored.data()?.questionId === questionId && stored.data()?.transcript === assessment.transcript, 'Speaking assessment did not persist and read back from Firestore.')
    await page.getByRole('heading', { name: 'Kerja bagus!', exact: true }).waitFor()
    await page.getByText(assessment.transcript, { exact: true }).waitFor()
    console.log(JSON.stringify({ suite: 'speaking', status: 'PASS', providerConfirmed: true, normalizedDimensions: true, transcriptReadback: true, studentUi: true }))
  } finally {
    await closeProdResources(resources, cleanup, config.cleanupAfterRun)
  }
}

async function runPronunciation(config) {
  const admin = createAdminClient(config)
  const studentUid = await verifyDedicatedIdentity(admin.auth, admin.db, config.student, 'student')
  await assertClassroomFixture(admin.db, config)
  const resources = attachAdmin(await launchProdBrowser(config, {
    args: ['--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${config.fixtures.audio}`],
    permissions: ['microphone'],
  }), admin)
  const cleanup = []
  const userRef = admin.db.collection('users').doc(studentUid)
  await restoreDocument(cleanup, userRef)
  const rateLimitId = createHash('sha256').update(`student-pronunciation:${studentUid}`).digest('hex')
  await restoreDocument(cleanup, admin.db.collection('apiRateLimits').doc(rateLimitId))
  const runId = randomUUID().replaceAll('-', '').slice(0, 10)
  const questionId = `000000e2e-${config.testPrefix}-${runId}-pronunciation`
  const questionRef = admin.db.collection('questionBank').doc(questionId)
  trackCleanupRef(cleanup, questionRef)
  const startedAt = Date.now()
  await questionRef.create({
    id: questionId,
    contentType: 'pronunciation',
    skill: 'pronunciation',
    level: 'intermediate',
    word: config.expectedText,
    ipa: '/e2e-test-target/',
    tip: 'Pronounce the exact test target clearly.',
    prompt: `${config.testPrefix} pronunciation fixture.`,
    options: ['recorded'],
    correctOption: 0,
    explanation: 'Dedicated production E2E pronunciation fixture.',
    tags: ['e2e', config.testPrefix],
    status: 'published',
    e2eTestPrefix: config.testPrefix,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  trackCleanupAction(cleanup, async () => {
    for (const collectionName of ['practiceAttempts', 'pronunciationResults']) {
      const documents = await admin.db.collection(collectionName).where('studentId', '==', studentUid).limit(200).get()
      await Promise.all(documents.docs.filter((document) => document.data().questionId === questionId).map((document) => document.ref.delete()))
    }
  })

  const page = resources.page
  try {
    await loginWithPassword(page, config, config.student, 'student')
    await page.goto(new URL(`/siswa/pronunciation?questionId=${encodeURIComponent(questionId)}`, config.baseUrl).toString())
    await page.getByRole('heading', { name: 'Pronunciation Lab', exact: true }).waitFor()
    await page.getByRole('heading', { name: config.expectedText, exact: true }).waitFor()
    await page.getByRole('button', { name: 'Rekam pelafalan' }).click()
    await page.getByText('Sedang mendengarkan… tekan untuk berhenti', { exact: true }).waitFor({ timeout: 15_000 })
    await page.getByText('00:02', { exact: true }).waitFor({ timeout: 15_000 })
    const resultPromise = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/student/pronunciation' && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Hentikan rekaman' }).click()
    const uiResponse = await resultPromise
    const uiPayload = await uiResponse.json()
    assert(uiResponse.status() === 200 && uiPayload.data, `Pronunciation provider returned ${uiResponse.status()}.`)
    assert(typeof uiPayload.data.score === 'number' && Array.isArray(uiPayload.data.words) && uiPayload.data.words.length > 0, 'Pronunciation result has no word-level scores.')
    assert(uiPayload.data.words.every((word) => Array.isArray(word.phonemes) && word.phonemes.length > 0), 'Pronunciation result has no phoneme-level details.')
    await page.getByText('Hasil provider tersimpan', { exact: true }).waitFor()
    await page.getByText(uiPayload.data.transcript, { exact: true }).waitFor()

    const persisted = await admin.db.collection('pronunciationResults').doc(uiPayload.data.id).get()
    assert(persisted.exists && persisted.data()?.studentId === studentUid && persisted.data()?.questionId === questionId, 'Pronunciation result did not read back from Firestore.')
    assert(Array.isArray(persisted.data()?.words) && persisted.data()?.words.length > 0, 'Per-word and per-phoneme result did not persist.')
    await page.reload()
    await page.getByRole('heading', { name: config.expectedText, exact: true }).waitFor()
    await page.getByText('Hasil provider tersimpan', { exact: true }).waitFor()

    const fixtureBytes = await readFile(config.fixtures.audio)
    const retryKey = `${config.testPrefix}-${runId}-retry`
    const retryRequest = () => page.request.post(new URL('/api/student/pronunciation', config.baseUrl).toString(), {
      headers: { 'Idempotency-Key': retryKey },
      multipart: {
        questionId,
        audio: { name: `${config.testPrefix}-pronunciation.wav`, mimeType: 'audio/wav', buffer: fixtureBytes },
      },
    })
    const firstRetryableAttempt = await retryRequest()
    assert(firstRetryableAttempt.status() === 200, `Pronunciation API read/write path returned ${firstRetryableAttempt.status()}.`)
    const firstRetryableResult = await firstRetryableAttempt.json()
    const replay = await retryRequest()
    const replayResult = await replay.json()
    assert(replay.status() === 200 && replayResult.data?.id === firstRetryableResult.data?.id, 'Same-key pronunciation retry did not replay the persisted result.')
    const duplicateResults = await admin.db.collection('pronunciationResults').where('studentId', '==', studentUid).limit(200).get()
    assert(duplicateResults.docs.filter((document) => document.data().idempotencyKey === retryKey).length === 1, 'Idempotent pronunciation retry created duplicate Firestore results.')

    const assessmentStatus = await admin.db.collection('practiceAttempts').doc(`practice-${Buffer.from(`${studentUid}:${retryKey}`).toString('base64url')}`).get()
    assert(assessmentStatus.exists && assessmentStatus.data()?.assessmentStatus === 'completed' && assessmentStatus.data()?.score === replayResult.data.score, 'Pronunciation practice attempt did not persist a completed provider score.')
    console.log(JSON.stringify({ suite: 'pronunciation', status: 'PASS', providerConfirmed: true, wordPhonemeDetails: true, firestoreReadback: true, reload: true, idempotentReplay: true, confidence: uiPayload.data.confidence === null ? 'not-returned' : 'returned' }))
  } finally {
    await closeProdResources(resources, cleanup, config.cleanupAfterRun)
  }
}

async function runVoice(config) {
  const admin = createAdminClient(config)
  const teacherUid = await verifyDedicatedIdentity(admin.auth, admin.db, config.teacher, 'teacher')
  const foreignTeacherUid = await verifyDedicatedIdentity(admin.auth, admin.db, config.foreignTeacher, 'teacher')
  const studentUid = await verifyDedicatedIdentity(admin.auth, admin.db, config.student, 'student')
  await assertClassroomFixture(admin.db, config)
  const foreignClassroom = await admin.db.collection('classrooms').doc(config.foreignClassroomId).get()
  assert(foreignClassroom.exists && foreignClassroom.data()?.teacherId === foreignTeacherUid, 'Foreign voice isolation classroom must belong to E2E_FOREIGN_TEACHER_UID.')
  const foreignMembership = await admin.db.collection('classMemberships').doc(`${config.foreignClassroomId}_${studentUid}`).get()
  assert(foreignMembership.exists && foreignMembership.data()?.status === 'active', 'Dedicated student must be a member of the foreign voice isolation classroom.')
  const foreignVoice = await admin.db.collection('voiceProfiles').doc(foreignTeacherUid).get()
  assert(!foreignVoice.exists, 'E2E_FOREIGN_TEACHER_UID must not have a configured voice profile for the isolation check.')

  const resources = attachAdmin(await launchProdBrowser(config), admin)
  const cleanup = []
  await restoreDocument(cleanup, admin.db.collection('apiRateLimits').doc(createHash('sha256').update(`voice-enrollment:${teacherUid}`).digest('hex')))
  const teacherPage = resources.page
  const studentContext = await resources.browser.newContext()
  const studentPage = await studentContext.newPage()
  const teacherVoiceRef = admin.db.collection('voiceProfiles').doc(teacherUid)
  let voiceProfileCreated = false
  const audioBytes = await readFile(config.fixtures.voice)
  const mimeType = audioMimeType(config.fixtures.voice)
  const fileName = `${config.testPrefix}-voice-reference${extname(config.fixtures.voice).toLowerCase()}`

  async function enrollFromSettings() {
    await teacherPage.getByLabel('Transcript sample').fill(config.voiceReferenceText)
    await teacherPage.getByLabel('Sample audio').setInputFiles({ name: fileName, mimeType, buffer: audioBytes })
    await teacherPage.getByRole('checkbox').check()
    const enrollment = await waitForApiResponse(
      teacherPage,
      '/api/teacher/voice-profile',
      'POST',
      () => teacherPage.getByRole('button', { name: 'Daftarkan voice', exact: true }).click(),
      'omnivoice',
    )
    assert([201, 202].includes(enrollment.response.status()), `Voice enrollment returned ${enrollment.response.status()}.`)
    voiceProfileCreated = true
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const status = await requestJson(teacherPage, config.baseUrl, '/api/teacher/voice-profile', {}, 'omnivoice')
      assert(status.response.status() === 200, `Voice status polling returned ${status.response.status()}.`)
      if (status.body?.data?.status === 'ready') return status.body.data
      if (status.body?.data?.status === 'failed') throw new Error('Voice provider returned a persisted failed enrollment state.')
      await new Promise((resolve) => setTimeout(resolve, 2_000))
    }
    throw new Error('Voice provider did not reach ready within the bounded E2E polling window.')
  }

  async function deleteFromSettings() {
    if (!new URL(teacherPage.url()).pathname.endsWith('/guru/pengaturan')) {
      await teacherPage.goto(new URL('/guru/pengaturan', config.baseUrl).toString())
      await teacherPage.getByRole('heading', { name: 'Voice profile OmniVoice', exact: true }).waitFor()
    }
    const deleted = await waitForApiResponse(
      teacherPage,
      '/api/teacher/voice-profile',
      'DELETE',
      () => teacherPage.getByRole('button', { name: 'Hapus profile' }).click(),
      'omnivoice',
    )
    assert(deleted.response.status() === 200 && deleted.body?.data?.status === 'not_configured', 'Voice delete did not confirm provider and server cleanup.')
    await teacherPage.getByText('Status: Belum terdaftar', { exact: true }).waitFor()
    assert(!(await teacherVoiceRef.get()).exists, 'Firestore voice profile remained after confirmed deletion.')
    voiceProfileCreated = false
  }

  try {
    await loginWithPassword(teacherPage, config, config.teacher, 'teacher')
    const startingProfile = await teacherPage.request.get(new URL('/api/teacher/voice-profile', config.baseUrl).toString())
    assert(startingProfile.status() === 200, 'Teacher voice profile status is unavailable.')
    const startingPayload = await startingProfile.json()
    assert(startingPayload.data?.status === 'not_configured', 'Dedicated E2E teacher must begin without an active voice profile.')
    assert(!(await teacherVoiceRef.get()).exists, 'Dedicated E2E teacher already has a stored voice profile.')

    await teacherPage.goto(new URL('/guru/pengaturan', config.baseUrl).toString())
    await teacherPage.getByRole('heading', { name: 'Voice profile OmniVoice', exact: true }).waitFor()
    const firstProfile = await enrollFromSettings()
    await teacherPage.getByText('Status: ready', { exact: true }).waitFor()
    const persisted = await teacherVoiceRef.get()
    const persistedProfile = persisted.data()
    assert(persisted.exists && persistedProfile?.status === 'ready' && persistedProfile?.providerVoiceId === firstProfile.providerVoiceId, 'Voice provider profile did not persist as ready.')
    assert(typeof persistedProfile?.consentAt === 'string' && !('audio' in persistedProfile) && !('referenceText' in persistedProfile), 'Voice enrollment stored raw sample/transcript data or omitted consent.')

    await teacherPage.getByLabel('Preview audio').fill(`${config.testPrefix} preview voice.`)
    const previewPromise = teacherPage.waitForResponse((response) => new URL(response.url()).pathname === '/api/teacher/voice-preview' && response.request().method() === 'POST')
    await teacherPage.getByRole('button', { name: 'Putar preview', exact: true }).click()
    const preview = await previewPromise
    const previewBytes = await preview.body()
    assert(preview.status() === 200 && preview.headers()['content-type']?.startsWith('audio/'), 'Provider preview did not return playable audio.')
    assert(previewBytes.byteLength > 0, 'Provider preview audio was empty.')
    logProdE2ERequest({ requestId: preview.headers()['x-request-id'] ?? null, route: '/api/teacher/voice-preview', status: preview.status(), errorCode: null, provider: 'omnivoice-tts', durationMs: 0 })

    await loginWithPassword(studentPage, config, config.student, 'student')
    await gotoSettled(studentPage, new URL('/siswa', config.baseUrl))
    const activeClassroom = studentPage.getByLabel('Pilih classroom aktif')
    if (await activeClassroom.count()) await activeClassroom.selectOption(config.classroomId)
    await studentPage.goto(new URL('/siswa/percakapan', config.baseUrl).toString())
    await studentPage.getByRole('heading', { name: 'AI Conversation', exact: true }).waitFor()
    const playbackPromise = studentPage.waitForResponse((response) => (
      new URL(response.url()).pathname === `/api/classrooms/${config.classroomId}/voice`
      && response.request().method() === 'POST'
    ))
    await studentPage.getByRole('button', { name: 'Putar audio' }).first().click()
    const playback = await playbackPromise
    const playbackBytes = await playback.body()
    assert(playback.status() === 200 && playback.headers()['content-type']?.startsWith('audio/'), 'Student classroom voice endpoint did not return teacher-voice audio.')
    assert(playbackBytes.byteLength > 0, 'Student voice playback audio was empty.')
    logProdE2ERequest({ requestId: playback.headers()['x-request-id'] ?? null, route: `/api/classrooms/${config.classroomId}/voice`, status: playback.status(), errorCode: null, provider: 'omnivoice-tts', durationMs: 0 })

    const foreignPlayback = await studentPage.request.post(new URL(`/api/classrooms/${config.foreignClassroomId}/voice`, config.baseUrl).toString(), {
      data: { text: 'Isolated voice profile check.' },
    })
    assert(foreignPlayback.status() === 409, 'Student access to a different teacher voice should fail until that teacher enrolls an isolated profile.')

    await deleteFromSettings()
    await teacherPage.goto(new URL('/guru/pengaturan', config.baseUrl).toString())
    const secondProfile = await enrollFromSettings()
    assert(secondProfile.status === 'ready' && secondProfile.providerVoiceId, 'Teacher could not re-enroll after an explicit delete.')
    await deleteFromSettings()
    console.log(JSON.stringify({ suite: 'voice', status: 'PASS', consent: true, pollingToReady: true, teacherPreview: true, studentPlayback: true, teacherIsolation: true, deleteAndReenroll: true, cleanup: 'provider-confirmed' }))
  } finally {
    if (voiceProfileCreated) {
      try {
        await deleteFromSettings()
      } catch {
        await studentContext.close().catch(() => {})
        await closeProdResources(resources, [], false)
        throw new Error('Voice E2E could not confirm provider deletion; cleanup remains required for the dedicated test teacher.')
      }
    }
    await studentContext.close()
    await closeProdResources(resources, cleanup, config.cleanupAfterRun)
  }
}

export const PROD_E2E_RUNNERS = {
  smoke: runSmoke,
  auth: runAuth,
  security: runSecurity,
  classroom: runClassroom,
  teacher: runTeacher,
  assignment: runAssignment,
  drive: runDrive,
  student: runStudent,
  speaking: runSpeaking,
  pronunciation: runPronunciation,
  voice: runVoice,
  offline: runOffline,
}

async function main() {
  const suite = process.argv[2]
  if (!suite || !PROD_E2E_SUITES.includes(suite)) {
    const error = new Error(`Usage: node apps/web/scripts/e2e-prod.mjs <${PROD_E2E_SUITES.join('|')}>`)
    error.name = 'ProdE2EError'
    throw error
  }
  const config = createProdE2EConfig(suite)
  if (suite === 'all') {
    const names = PROD_E2E_SUITES.filter((candidate) => candidate !== 'all')
    const configs = names.map((name) => [name, createProdE2EConfig(name)])
    const missingImplementations = names.filter((name) => !PROD_E2E_RUNNERS[name])
    if (missingImplementations.length) throw new Error(`Production E2E implementation is missing: ${missingImplementations.join(', ')}`)
    for (const [name, suiteConfig] of configs) {
      await PROD_E2E_RUNNERS[name](suiteConfig)
    }
    return
  }
  const run = PROD_E2E_RUNNERS[suite]
  if (!run) throw new Error(`Production E2E implementation is missing: ${suite}`)
  await run(config)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const safeFailure = error?.name === 'ProdE2EError' || error?.name === 'ProdE2EConfigError'
    // Reproducible failure evidence is required for every FAIL; scrub every
    // known dedicated-account credential before printing diagnostics.
    let message = error?.message ?? 'unknown failure'
    try {
      const config = createProdE2EConfig(process.argv[2] ?? 'smoke')
      for (const identity of [config.student, config.teacher, config.foreignTeacher]) {
        if (!identity) continue
        if (identity.password) message = message.replaceAll(identity.password, '[redacted:password]')
        if (identity.email) message = message.replaceAll(identity.email, '[redacted:email]')
      }
      if (config.admin?.privateKey) message = message.replaceAll(config.admin.privateKey, '[redacted:key]')
    } catch {}
    console.error(JSON.stringify({
      suite: process.argv[2] ?? null,
      status: 'FAIL',
      errorCode: safeFailure ? 'ASSERTION_OR_CONFIG_FAILURE' : 'EXTERNAL_OR_RUNTIME_FAILURE',
      message,
      failureUrl: globalThis.__prodE2EFailureContext?.url ?? null,
      failureMainText: globalThis.__prodE2EFailureContext?.mainText ?? null,
      failureButtonStates: globalThis.__prodE2EFailureContext?.buttons ?? null,
    }))
    process.exitCode = 1
  })
}
