import { chromium } from 'playwright'
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

/**
 * End-to-end device monitoring: the teacher generates a pairing code in the UI,
 * the device claims it, sends telemetry, the fleet view shows the unit with its
 * own id, and revoking it from the UI cuts the device off.
 *
 * Runs against a real Firebase project, so it mints its own teacher session
 * instead of depending on a seeded password.
 */

// Mirrors lib/config/env.ts so a quoted or escaped PEM from the environment
// parses the same way the app parses it.
function normalizePem(value) {
  const trimmed = value.trim()
  const unquoted = /^(['"])[\s\S]*\1$/.test(trimmed) ? trimmed.slice(1, -1) : trimmed
  return unquoted.replace(/\\n/g, '\n').trim()
}

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY ? normalizePem(process.env.FIREBASE_ADMIN_PRIVATE_KEY) : undefined
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY

if (!projectId || !clientEmail || !privateKey || !apiKey) {
  throw new Error('FIREBASE_ADMIN_* and NEXT_PUBLIC_FIREBASE_API_KEY are required to run this E2E.')
}

const TEACHER_UID = 'e2e-device-monitor-teacher'
const TEACHER_EMAIL = 'e2e.device.monitor@tuturai.test'
const HARDWARE_ID = 'E2E:AA:BB:CC:DD:EE'
const FIRMWARE = '1.4.2'

const app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
const auth = getAuth(app)
const db = getFirestore(app)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function ensureTeacher() {
  try {
    await auth.getUser(TEACHER_UID)
  } catch {
    await auth.createUser({ uid: TEACHER_UID, email: TEACHER_EMAIL, emailVerified: true })
  }
  await db.collection('users').doc(TEACHER_UID).set(
    { role: 'teacher', displayName: 'E2E Monitor', email: TEACHER_EMAIL, xp: 0, level: 1, streak: 0 },
    { merge: true },
  )
}

async function mintSessionCookie() {
  const customToken = await auth.createCustomToken(TEACHER_UID)
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  })
  const payload = await response.json()
  if (!payload.idToken) throw new Error(`Custom token exchange failed: ${JSON.stringify(payload)}`)
  return auth.createSessionCookie(payload.idToken, { expiresIn: 60 * 60 * 1000 })
}

async function clearDevices() {
  const snapshot = await db.collection('devices').where('ownerTeacherId', '==', TEACHER_UID).get()
  await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()))
}

await ensureTeacher()
await clearDevices()

const sessionCookie = await mintSessionCookie()
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
await context.addCookies([
  {
    name: 'tuturai_session',
    value: sessionCookie,
    domain: new URL(baseURL).hostname,
    path: '/',
    httpOnly: true,
    secure: baseURL.startsWith('https'),
    sameSite: 'Lax',
  },
])
const page = await context.newPage()

try {
  await page.goto(`${baseURL}/guru/perangkat`)
  await page.getByText('Armada Perangkat', { exact: false }).first().waitFor()
  await page.getByText('Belum ada perangkat terdaftar', { exact: false }).first().waitFor()

  await page.getByRole('button', { name: 'Buat kode pairing' }).first().click()
  const codeLocator = page.getByTestId('pairing-code')
  await codeLocator.waitFor()
  const pairingCode = (await codeLocator.innerText()).trim()
  assert(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/.test(pairingCode), `Unexpected pairing code: ${pairingCode}`)

  const pairResponse = await page.request.post(`${baseURL}/api/device/pair`, {
    data: { code: pairingCode, hardwareId: HARDWARE_ID, firmware: FIRMWARE },
  })
  assert(pairResponse.status() === 200, `Expected pair 200, received ${pairResponse.status()}`)
  const pairPayload = await pairResponse.json()
  const deviceId = pairPayload.data?.deviceId
  const secret = pairPayload.data?.secret
  assert(typeof deviceId === 'string' && deviceId.length > 0, 'Pair response did not include a device id')
  assert(typeof secret === 'string' && secret.length > 0, 'Pair response did not include a device secret')
  assert(pairPayload.data?.heartbeatIntervalSeconds === 30, 'Pair response did not publish the heartbeat cadence')

  const replay = await page.request.post(`${baseURL}/api/device/pair`, { data: { code: pairingCode } })
  assert(replay.status() === 401, `Expected a replayed pairing code to be rejected, received ${replay.status()}`)

  const heartbeat = await page.request.post(`${baseURL}/api/device/heartbeat`, {
    headers: { 'x-device-id': deviceId, 'x-device-secret': secret },
    data: { battery: 82, signal: 67, firmware: FIRMWARE },
  })
  assert(heartbeat.status() === 200, `Expected heartbeat 200, received ${heartbeat.status()}`)

  const badSecret = await page.request.post(`${baseURL}/api/device/heartbeat`, {
    headers: { 'x-device-id': deviceId, 'x-device-secret': 'wrong-secret' },
    data: { battery: 50 },
  })
  assert(badSecret.status() === 401, `Expected a bad device secret to be rejected, received ${badSecret.status()}`)

  const deviceStatus = await page.request.get(`${baseURL}/api/device/status`, {
    headers: { 'x-device-id': deviceId, 'x-device-secret': secret },
  })
  assert(deviceStatus.status() === 200, `Expected device status 200, received ${deviceStatus.status()}`)
  const deviceStatusPayload = await deviceStatus.json()
  assert(deviceStatusPayload.data?.deviceId === deviceId, 'Device status returned a different device id')
  assert(deviceStatusPayload.data?.status === 'online', `Expected online, received ${deviceStatusPayload.data?.status}`)

  const list = await page.request.get(`${baseURL}/api/teacher/devices`)
  assert(list.status() === 200, `Expected teacher device list 200, received ${list.status()}`)
  const listPayload = await list.json()
  const record = listPayload.data?.find((device) => device.id === deviceId)
  assert(record, 'Teacher device list did not include the paired device')
  assert(record.status === 'online', `Expected online, received ${record.status}`)
  assert(record.battery === 82 && record.signal === 67, 'Telemetry did not read back')
  assert(record.firmware === FIRMWARE, 'Firmware did not read back')
  assert(record.hardwareId === HARDWARE_ID, 'Hardware id did not read back')
  assert(record.activity?.length === 24, 'Activity series was not 24 buckets')
  assert(record.activity.at(-1).count >= 1, 'Current hour bucket did not record the heartbeat')

  await page.reload()
  const row = page.locator('li', { hasText: deviceId }).first()
  await row.waitFor()
  const rowText = await row.innerText()
  assert(/Online/i.test(rowText), `Device row did not show the online state: ${rowText}`)
  assert(/82%/.test(rowText), `Device row did not show the battery level: ${rowText}`)

  await row.getByRole('button', { name: 'Cabut' }).click()
  await row.getByRole('button', { name: 'Yakin' }).click()
  await page.getByText('Belum ada perangkat terdaftar', { exact: false }).first().waitFor()

  const afterRevoke = await page.request.post(`${baseURL}/api/device/heartbeat`, {
    headers: { 'x-device-id': deviceId, 'x-device-secret': secret },
    data: { battery: 50 },
  })
  assert(afterRevoke.status() === 401, `Expected a revoked device heartbeat to be rejected, received ${afterRevoke.status()}`)

  console.log(JSON.stringify({
    ok: true,
    pairing: 'code-issued-in-ui-and-claimed-once',
    deviceId,
    telemetry: 'battery-82-signal-67-firmware-1.4.2',
    fleetView: 'online-row-with-id-and-battery',
    revoke: 'ui-revoke-blocks-heartbeat',
  }))
} finally {
  await clearDevices()
  await context.close()
  await browser.close()
}
