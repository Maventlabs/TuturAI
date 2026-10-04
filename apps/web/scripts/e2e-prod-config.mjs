import { existsSync, statSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PROD_E2E_SUITES = [
  'smoke', 'auth', 'student', 'teacher', 'classroom', 'assignment', 'drive',
  'speaking', 'pronunciation', 'voice', 'offline', 'security', 'all',
]

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const EMULATOR_ENV_KEYS = [
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIRESTORE_EMULATOR_HOST',
  'NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST',
  'NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_HOST',
]
const AUTH = ['E2E_STUDENT_EMAIL', 'E2E_STUDENT_PASSWORD', 'E2E_STUDENT_UID']
const TEACHER = ['E2E_TEACHER_EMAIL', 'E2E_TEACHER_PASSWORD', 'E2E_TEACHER_UID']
const FOREIGN_TEACHER = ['E2E_FOREIGN_TEACHER_EMAIL', 'E2E_FOREIGN_TEACHER_PASSWORD', 'E2E_FOREIGN_TEACHER_UID']
const ADMIN = [
  'E2E_FIREBASE_PROJECT_ID',
  'E2E_FIREBASE_ADMIN_PROJECT_ID',
  'E2E_FIREBASE_ADMIN_CLIENT_EMAIL',
  'E2E_FIREBASE_ADMIN_PRIVATE_KEY',
]
const DATA = ['E2E_TEST_PREFIX']
const APPROVAL = ['E2E_TEST_DATA_APPROVED']
const DRIVE_ACCOUNT = ['E2E_DRIVE_ACCOUNT_EMAIL', 'E2E_DRIVE_ACCOUNT_APPROVED']

const requirements = {
  smoke: [],
  auth: [...AUTH, ...TEACHER, ...ADMIN, ...DATA, ...APPROVAL, 'E2E_GOOGLE_AUTH_EMAIL', 'E2E_GOOGLE_AUTH_ROLE', 'E2E_GOOGLE_AUTH_TEST_ACCOUNT_APPROVED'],
  student: [...AUTH, ...TEACHER, ...ADMIN, ...DATA, ...APPROVAL, 'E2E_CLASSROOM_ID'],
  teacher: [...TEACHER, ...ADMIN, ...DATA, ...APPROVAL, 'E2E_CLASSROOM_ID'],
  classroom: [...AUTH, ...TEACHER, ...ADMIN, ...DATA, ...APPROVAL],
  assignment: [...AUTH, ...TEACHER, ...ADMIN, ...DATA, ...APPROVAL, 'E2E_CLASSROOM_ID'],
  drive: [...AUTH, ...TEACHER, ...ADMIN, ...DATA, ...APPROVAL, ...DRIVE_ACCOUNT, 'E2E_CLASSROOM_ID', 'E2E_DRIVE_TEST_FILE'],
  speaking: [...AUTH, ...TEACHER, ...ADMIN, ...DATA, ...APPROVAL, 'E2E_CLASSROOM_ID', 'E2E_AUDIO_FIXTURE_PATH', 'E2E_EXPECTED_TEXT'],
  pronunciation: [...AUTH, ...TEACHER, ...ADMIN, ...DATA, ...APPROVAL, 'E2E_CLASSROOM_ID', 'E2E_AUDIO_FIXTURE_PATH', 'E2E_EXPECTED_TEXT'],
  voice: [...AUTH, ...TEACHER, ...FOREIGN_TEACHER, ...ADMIN, ...DATA, ...APPROVAL, 'E2E_CLASSROOM_ID', 'E2E_FOREIGN_CLASSROOM_ID', 'E2E_VOICE_AUDIO_FIXTURE', 'E2E_VOICE_REFERENCE_TEXT'],
  offline: [...AUTH, ...TEACHER, ...ADMIN, ...DATA, ...APPROVAL, ...DRIVE_ACCOUNT, 'E2E_CLASSROOM_ID', 'E2E_DRIVE_TEST_FILE', 'E2E_AUDIO_FIXTURE_PATH', 'E2E_EXPECTED_TEXT'],
  security: [...AUTH, ...TEACHER, ...FOREIGN_TEACHER, ...ADMIN, 'E2E_CLASSROOM_ID', 'E2E_FOREIGN_CLASSROOM_ID', 'E2E_REVOKED_JOIN_CLASSROOM_ID', 'E2E_REVOKED_JOIN_KEY'],
}

const featureFlags = {
  auth: ['E2E_GOOGLE_AUTH_ENABLED'],
  drive: ['E2E_DRIVE_ENABLED'],
  speaking: ['E2E_AI_ENABLED'],
  pronunciation: ['E2E_PRONUNCIATION_ENABLED'],
  voice: ['E2E_VOICE_ENABLED'],
  offline: ['E2E_DRIVE_ENABLED', 'E2E_AI_ENABLED'],
}

function missingNames(env, names) {
  return names.filter((name) => !String(env[name] ?? '').trim())
}

function validatedUrl(value, env) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('Invalid E2E_BASE_URL; provide the deployed Netlify HTTPS URL.')
  }

  const localHost = /^(localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)$/i.test(url.hostname)
  const netlifyHost = url.hostname === 'netlify.app' || url.hostname.endsWith('.netlify.app')
  if (url.protocol !== 'https:' || localHost || url.username || url.password || url.search || url.hash) {
    throw new Error('E2E_BASE_URL must be an HTTPS deployment URL with no credentials, query, or fragment.')
  }
  if (!netlifyHost && envFlag(env.E2E_ALLOW_CUSTOM_NETLIFY_HOST) !== 'true') {
    throw new Error('E2E_BASE_URL must use *.netlify.app; set E2E_ALLOW_CUSTOM_NETLIFY_HOST=true only for the configured Netlify custom domain.')
  }
  if (url.pathname !== '/' && url.pathname !== '') throw new Error('E2E_BASE_URL must be the deployment origin, without a path prefix.')
  url.pathname = '/'
  return url
}

function envFlag(value) {
  return String(value ?? '').trim().toLowerCase()
}

function resolveFixture(env, name, extensions, maxBytes) {
  const configured = String(env[name] ?? '').trim()
  if (!configured) return null
  const absolute = resolve(ROOT, configured)
  const rel = relative(ROOT, absolute)
  if (!rel || rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) {
    throw new Error(`${name} must point to a project-owned test fixture inside the repository.`)
  }
  if (!existsSync(absolute)) throw new Error(`${name} points to a missing test fixture.`)
  const extension = absolute.slice(absolute.lastIndexOf('.')).toLowerCase()
  if (!extensions.includes(extension)) throw new Error(`${name} has an unsupported fixture extension.`)
  const size = statSync(absolute).size
  if (size < 1 || size > maxBytes) throw new Error(`${name} fixture size must be between 1 byte and ${maxBytes} bytes.`)
  return absolute
}

function validateIdentity(env, emailKey, uidKey, role) {
  const email = String(env[emailKey] ?? '').trim()
  const uid = String(env[uidKey] ?? '').trim()
  if (!email.includes('@')) throw new Error(`${emailKey} must be an email for a dedicated E2E account.`)
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(uid)) throw new Error(`${uidKey} must identify the dedicated ${role} E2E user.`)
  return { email, uid, password: String(env[emailKey.replace('_EMAIL', '_PASSWORD')] ?? '') }
}

function buildProdE2EConfig(suite, env = process.env) {
  if (!PROD_E2E_SUITES.includes(suite)) {
    throw new Error(`Unknown production E2E suite. Choose: ${PROD_E2E_SUITES.join(', ')}`)
  }

  const baseUrlValue = String(env.E2E_BASE_URL ?? '').trim()
  if (!baseUrlValue) throw new Error('Missing required environment variable: E2E_BASE_URL')
  const baseUrl = validatedUrl(baseUrlValue, env)
  const configuredEmulators = EMULATOR_ENV_KEYS.filter((name) => String(env[name] ?? '').trim())
  if (configuredEmulators.length) {
    throw new Error(`Production E2E refuses Firebase emulator variables: ${configuredEmulators.join(', ')}`)
  }

  const selected = suite === 'all'
    ? [...new Set(Object.values(requirements).flat())]
    : requirements[suite]
  const enabledFlags = suite === 'all'
    ? [...new Set(Object.values(featureFlags).flat())]
    : (featureFlags[suite] ?? [])
  const disabled = enabledFlags.filter((name) => envFlag(env[name]) !== 'true')
  if (disabled.length) throw new Error(`Production E2E will not skip gated flows; set ${disabled.map((name) => `${name}=true`).join(', ')}`)

  const missing = missingNames(env, selected)
  if (missing.length) throw new Error(`Missing required production E2E configuration: ${missing.join(', ')}`)

  const mutating = suite !== 'smoke' && suite !== 'security'
  if (mutating && envFlag(env.E2E_TEST_DATA_APPROVED) !== 'true') {
    throw new Error('E2E_TEST_DATA_APPROVED=true is required before production data mutations.')
  }
  if (mutating && envFlag(env.E2E_CLEANUP_AFTER_RUN) === 'false') {
    throw new Error('E2E_CLEANUP_AFTER_RUN cannot be false for production E2E suites.')
  }
  if (selected.includes('E2E_GOOGLE_AUTH_TEST_ACCOUNT_APPROVED') && envFlag(env.E2E_GOOGLE_AUTH_TEST_ACCOUNT_APPROVED) !== 'true') {
    throw new Error('E2E_GOOGLE_AUTH_TEST_ACCOUNT_APPROVED=true is required for the manual Google account checkpoint.')
  }
  if (selected.includes('E2E_DRIVE_ACCOUNT_APPROVED') && envFlag(env.E2E_DRIVE_ACCOUNT_APPROVED) !== 'true') {
    throw new Error('E2E_DRIVE_ACCOUNT_APPROVED=true is required for Google Drive consent and file cleanup.')
  }
  if ((suite === 'auth' || suite === 'drive' || suite === 'offline' || suite === 'all') && envFlag(env.E2E_HEADLESS) !== 'false') {
    throw new Error('E2E_HEADLESS=false is required for the explicit Google account consent checkpoints.')
  }

  const testPrefix = String(env.E2E_TEST_PREFIX ?? '').trim()
  if (DATA.includes('E2E_TEST_PREFIX') && selected.includes('E2E_TEST_PREFIX') && !/^e2e-[a-z0-9-]{3,40}$/.test(testPrefix)) {
    throw new Error('E2E_TEST_PREFIX must match e2e-[a-z0-9-]{3,40}.')
  }

  const projectId = String(env.E2E_FIREBASE_PROJECT_ID ?? '').trim()
  const adminProjectId = String(env.E2E_FIREBASE_ADMIN_PROJECT_ID ?? '').trim()
  if (selected.some((name) => ADMIN.includes(name))) {
    if (projectId.startsWith('demo-') || projectId.includes('emulator')) {
      throw new Error('E2E_FIREBASE_PROJECT_ID must be the real Firebase project; emulator projects are forbidden.')
    }
    if (projectId !== adminProjectId) throw new Error('E2E_FIREBASE_ADMIN_PROJECT_ID must match E2E_FIREBASE_PROJECT_ID.')
    if (!String(env.E2E_FIREBASE_ADMIN_CLIENT_EMAIL).endsWith(`@${projectId}.iam.gserviceaccount.com`)) {
      throw new Error('E2E_FIREBASE_ADMIN_CLIENT_EMAIL must belong to E2E_FIREBASE_PROJECT_ID.')
    }
    const privateKey = String(env.E2E_FIREBASE_ADMIN_PRIVATE_KEY).replace(/\\n/g, '\n')
    if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----') || !privateKey.trimEnd().endsWith('-----END PRIVATE KEY-----')) {
      throw new Error('E2E_FIREBASE_ADMIN_PRIVATE_KEY must be a PEM private key.')
    }
  }

  const student = selected.some((name) => AUTH.includes(name))
    ? validateIdentity(env, 'E2E_STUDENT_EMAIL', 'E2E_STUDENT_UID', 'student')
    : null
  const teacher = selected.some((name) => TEACHER.includes(name))
    ? validateIdentity(env, 'E2E_TEACHER_EMAIL', 'E2E_TEACHER_UID', 'teacher')
    : null
  const foreignTeacher = selected.some((name) => FOREIGN_TEACHER.includes(name))
    ? validateIdentity(env, 'E2E_FOREIGN_TEACHER_EMAIL', 'E2E_FOREIGN_TEACHER_UID', 'foreign teacher')
    : null

  for (const identity of [student, teacher, foreignTeacher].filter(Boolean)) {
    if (identity.password.length < 12) throw new Error('Production E2E account passwords must be at least 12 characters.')
  }

  const googleRole = String(env.E2E_GOOGLE_AUTH_ROLE ?? '').trim()
  if (selected.includes('E2E_GOOGLE_AUTH_ROLE') && !['student', 'teacher'].includes(googleRole)) {
    throw new Error('E2E_GOOGLE_AUTH_ROLE must be student or teacher.')
  }
  const driveAccountEmail = String(env.E2E_DRIVE_ACCOUNT_EMAIL ?? '').trim()
  if (selected.includes('E2E_DRIVE_ACCOUNT_EMAIL') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(driveAccountEmail)) {
    throw new Error('E2E_DRIVE_ACCOUNT_EMAIL must identify the dedicated Google Drive test account.')
  }

  const audioFixture = selected.includes('E2E_AUDIO_FIXTURE_PATH')
    ? resolveFixture(env, 'E2E_AUDIO_FIXTURE_PATH', ['.wav'], 10 * 1024 * 1024)
    : null
  const voiceFixture = selected.includes('E2E_VOICE_AUDIO_FIXTURE')
    ? resolveFixture(env, 'E2E_VOICE_AUDIO_FIXTURE', ['.wav', '.mp3', '.m4a', '.ogg', '.webm'], 15 * 1024 * 1024)
    : null
  const driveFixture = selected.includes('E2E_DRIVE_TEST_FILE')
    ? resolveFixture(env, 'E2E_DRIVE_TEST_FILE', ['.pdf', '.docx', '.pptx', '.xlsx', '.txt', '.jpg', '.jpeg', '.png', '.webp'], 25 * 1024 * 1024)
    : null

  return {
    suite,
    baseUrl,
    projectId: selected.some((name) => ADMIN.includes(name)) ? projectId : null,
    admin: selected.some((name) => ADMIN.includes(name)) ? {
      projectId,
      clientEmail: env.E2E_FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: String(env.E2E_FIREBASE_ADMIN_PRIVATE_KEY).replace(/\\n/g, '\n'),
    } : null,
    student,
    teacher,
    foreignTeacher,
    testPrefix: testPrefix || null,
    classroomId: String(env.E2E_CLASSROOM_ID ?? '').trim() || null,
    foreignClassroomId: String(env.E2E_FOREIGN_CLASSROOM_ID ?? '').trim() || null,
    revokedJoinClassroomId: String(env.E2E_REVOKED_JOIN_CLASSROOM_ID ?? '').trim() || null,
    revokedJoinKey: String(env.E2E_REVOKED_JOIN_KEY ?? '').trim() || null,
    googleAuth: enabledFlags.includes('E2E_GOOGLE_AUTH_ENABLED') ? {
      email: String(env.E2E_GOOGLE_AUTH_EMAIL).trim(),
      role: googleRole,
    } : null,
    driveAccount: selected.includes('E2E_DRIVE_ACCOUNT_EMAIL') ? { email: driveAccountEmail } : null,
    fixtures: { audio: audioFixture, voice: voiceFixture, drive: driveFixture },
    expectedText: String(env.E2E_EXPECTED_TEXT ?? '').trim() || null,
    voiceReferenceText: String(env.E2E_VOICE_REFERENCE_TEXT ?? '').trim() || null,
    cleanupAfterRun: true,
    headless: envFlag(env.E2E_HEADLESS) !== 'false',
  }
}

export class ProdE2EConfigError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ProdE2EConfigError'
  }
}

export function createProdE2EConfig(suite, env = process.env) {
  try {
    return buildProdE2EConfig(suite, env)
  } catch (error) {
    throw new ProdE2EConfigError(error instanceof Error ? error.message : 'Production E2E configuration is invalid.')
  }
}
