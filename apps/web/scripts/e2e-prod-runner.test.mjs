import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PROD_E2E_SUITES } from './e2e-prod-config.mjs'
import { PROD_E2E_RUNNERS } from './e2e-prod.mjs'

test('every production suite except the orchestrator has a concrete runner', () => {
  const expected = PROD_E2E_SUITES.filter((suite) => suite !== 'all').sort()
  assert.deepEqual(Object.keys(PROD_E2E_RUNNERS).sort(), expected)
  assert.equal(typeof PROD_E2E_RUNNERS.drive, 'function')
  assert.equal(typeof PROD_E2E_RUNNERS.offline, 'function')
  assert.equal(typeof PROD_E2E_RUNNERS.voice, 'function')
})

test('protected achievement, profile, leaderboard, and device menus assert server-backed actions', async () => {
  const runnerPath = resolve(dirname(fileURLToPath(import.meta.url)), 'e2e-prod.mjs')
  const source = await readFile(runnerPath, 'utf8')
  const studentRunner = source.slice(source.indexOf('async function runStudent('), source.indexOf('async function runDrive('))
  const teacherRunner = source.slice(source.indexOf('async function runTeacher('), source.indexOf('async function runAssignment('))
  const offlineRunner = source.slice(source.indexOf('async function runOffline('), source.indexOf('async function runSpeaking('))

  assert.match(studentRunner, /achievementIds\?\.includes\('scholar'\)/)
  assert.match(studentRunner, /persistedScholarCard\.getByText\('Terbuka'/)
  assert.match(studentRunner, /profileReadback\.body\?\.data\?\.profile/)
  assert.match(studentRunner, /Student profile name did not restore after reload/)
  assert.match(studentRunner, /Student profile school did not restore after reload/)
  assert.match(teacherRunner, /leaderboardServerOrdering/)
  assert.match(teacherRunner, /\/api\/teacher\/devices/)
  assert.match(teacherRunner, /credentialHash === createHash\('sha256'\)/)
  assert.match(teacherRunner, /\/api\/teacher\/devices\?deviceId=/)
  assert.match(teacherRunner, /revokedSnapshot\.data\(\)\?\.revokedAt != null/)
  assert.match(teacherRunner, /invalidHeartbeat\.response\.status\(\) === 401/)
  assert.match(teacherRunner, /validHeartbeat\.response\.status\(\) === 200/)
  assert.match(offlineRunner, /readOfflineMutationState\(studentPage, 'conversation-text'\)/)
  assert.match(offlineRunner, /conversationTextAttempts/)
  assert.match(offlineRunner, /textAttempts\.size === 1/)
})

test('all 26 protected menu rows map to a production runner navigation and durable assertion', async () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
  const [execution, source] = await Promise.all([
    readFile(resolve(root, 'EXECUTION.md'), 'utf8'),
    readFile(resolve(dirname(fileURLToPath(import.meta.url)), 'e2e-prod.mjs'), 'utf8'),
  ])
  const menuRows = execution.split(/\r?\n/)
    .filter((line) => line.trim().startsWith('| `/'))
    .map((line) => line.split('|')[1].trim().replaceAll('`', ''))
  const requiredMenus = [
    '/dashboard', '/onboarding', '/siswa', '/siswa/penugasan', '/siswa/speaking',
    '/siswa/percakapan text', '/siswa/percakapan voice', '/siswa/pronunciation',
    '/siswa/vocabulary', '/siswa/listening', '/siswa/quiz', '/siswa/tes',
    '/siswa/adaptive', '/siswa/progress', '/siswa/leaderboard', '/siswa/achievements',
    '/siswa/profil', '/guru', '/guru/kelas', '/guru/penugasan', '/guru/siswa',
    '/guru/penilaian', '/guru/analitik', '/guru/leaderboard', '/guru/pengaturan',
    '/guru/perangkat',
  ]
  assert.deepEqual(menuRows, requiredMenus, 'Protected menu matrix must retain exactly the 26 canonical rows and order.')

  const functionBody = (name, nextName) => source.slice(source.indexOf(`async function ${name}(`), source.indexOf(`async function ${nextName}(`))
  const runners = {
    auth: functionBody('runAuth', 'runSecurity'),
    classroom: functionBody('runClassroom', 'runTeacher'),
    teacher: functionBody('runTeacher', 'runAssignment'),
    assignment: functionBody('runAssignment', 'runStudent'),
    student: functionBody('runStudent', 'runDrive'),
    speaking: functionBody('runSpeaking', 'runPronunciation'),
    pronunciation: functionBody('runPronunciation', 'runVoice'),
    offline: functionBody('runOffline', 'runSpeaking'),
  }
  const assertions = [
    ['/dashboard', 'auth', "pathname === '/dashboard'", /logoutAndAssertUnauthorized/],
    ['/onboarding', 'auth', "await page.getByRole('button', { name: roleName, exact: true }).click()", /Google onboarding role did not persist/],
    ['/siswa', 'classroom', "new URL('/siswa', config.baseUrl)", /classroomId/],
    ['/siswa/penugasan', 'assignment', "new URL('/siswa/penugasan', config.baseUrl)", /finalSubmission\.data\(\)\?\.attempt/],
    ['/siswa/speaking', 'speaking', "new URL(`/siswa/speaking?questionId=", /Speaking assessment did not persist and read back from Firestore/],
    ['/siswa/percakapan text', 'student', "getByLabel('Jawaban percakapan')", /conversationTextAttempts/],
    ['/siswa/percakapan voice', 'offline', "getByRole('button', { name: 'Rekam suara' })", /persistedAssessment\.exists/],
    ['/siswa/pronunciation', 'pronunciation', "new URL(`/siswa/pronunciation?questionId=", /Pronunciation result did not read back from Firestore/],
    ['/siswa/vocabulary', 'student', "new URL('/siswa/vocabulary', config.baseUrl)", /Semua kartu kosakata pada sesi ini sudah dikonfirmasi tersimpan/],
    ['/siswa/listening', 'student', "new URL('/siswa/listening', config.baseUrl)", /Learning attempts did not all persist in Firestore/],
    ['/siswa/quiz', 'student', "answerQuestionRound('/siswa/quiz'", /Learning attempts did not all persist in Firestore/],
    ['/siswa/tes', 'student', "answerQuestionRound('/siswa/tes'", /Learning attempts did not all persist in Firestore/],
    ['/siswa/adaptive', 'student', "new URL('/siswa/adaptive', config.baseUrl)", /adaptiveAfter/],
    ['/siswa/progress', 'student', "new URL('/siswa/progress', config.baseUrl)", /Progress Belajar/],
    ['/siswa/leaderboard', 'student', "new URL('/siswa/leaderboard', config.baseUrl)", /leaderboardRows\.every/],
    ['/siswa/achievements', 'student', "new URL('/siswa/achievements', config.baseUrl)", /persistedScholarCard/],
    ['/siswa/profil', 'student', "new URL('/siswa/profil', config.baseUrl)", /Student profile name did not restore after reload/],
    ['/guru', 'teacher', "loginWithPassword(page, config, config.teacher, 'teacher')", /Dashboard Guru/],
    ['/guru/kelas', 'classroom', "new URL('/guru/kelas', config.baseUrl)", /memberReadback/],
    ['/guru/penugasan', 'assignment', "new URL('/guru/penugasan', config.baseUrl)", /assignmentRef/],
    ['/guru/siswa', 'teacher', "new URL('/guru/siswa', config.baseUrl)", /studentDetails\.body/],
    ['/guru/penilaian', 'assignment', "new URL('/guru/penilaian', config.baseUrl)", /submissionRef/],
    ['/guru/analitik', 'teacher', "new URL('/guru/analitik', config.baseUrl)", /PDF report did not match/],
    ['/guru/leaderboard', 'teacher', "new URL('/guru/leaderboard', config.baseUrl)", /leaderboardServerOrdering/],
    ['/guru/pengaturan', 'teacher', "new URL('/guru/pengaturan', config.baseUrl)", /settingsFirestoreReadback/],
    ['/guru/perangkat', 'teacher', "new URL('/guru/perangkat', config.baseUrl)", /deviceRevocationReadback/],
  ]

  assert.equal(assertions.length, 26)
  for (const [menu, runnerName, navigation, durableAssertion] of assertions) {
    assert.ok(menuRows.includes(menu), `${menu} is not present in the protected menu matrix.`)
    assert.ok(runners[runnerName].includes(navigation), `${menu} has no production runner navigation.`)
    assert.match(runners[runnerName], durableAssertion, `${menu} has no durable server/persistence assertion.`)
  }
})

test('package commands expose every production suite without aliases or gaps', async () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
  const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
  for (const suite of PROD_E2E_SUITES) {
    if (suite === 'all') continue
    assert.equal(packageJson.scripts[`e2e:prod:${suite}`], `node apps/web/scripts/e2e-prod.mjs ${suite}`)
  }
  assert.equal(packageJson.scripts['e2e:prod:config:test'], 'node --test apps/web/scripts/e2e-prod-config.test.mjs apps/web/scripts/e2e-prod-runner.test.mjs')
  assert.equal(packageJson.scripts['e2e:prod:all'], 'node apps/web/scripts/e2e-prod.mjs all')
})
