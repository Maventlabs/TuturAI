import { chromium } from 'playwright'

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
const email = 'ava.pratama@demo.example.test'
const password = 'DemoTeacher2026!'

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run this script with Firebase Auth and Firestore emulators.')
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()

async function readJSON(response) {
  return response.json()
}

try {
  await page.goto(`${baseURL}/auth/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Kata Sandi').fill(password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/dashboard' || url.pathname.includes('/guru'), { timeout: 15_000 })

  const leaderboard = await page.request.get(`${baseURL}/api/teacher/leaderboard`)
  if (leaderboard.status() !== 200) throw new Error(`Expected teacher leaderboard 200, received ${leaderboard.status()}`)
  const leaderboardPayload = await readJSON(leaderboard)
  if (!Array.isArray(leaderboardPayload.data) || leaderboardPayload.data.some((row, index, rows) => row.rank !== index + 1 || (index > 0 && rows[index - 1].xp < row.xp))) {
    throw new Error(`Teacher leaderboard was not ordered by durable XP: ${JSON.stringify(leaderboardPayload)}`)
  }
  await page.goto(`${baseURL}/guru/leaderboard`)
  await page.getByRole('heading', { name: 'Papan Peringkat', exact: true }).waitFor()

  const classrooms = await page.request.get(`${baseURL}/api/classrooms`)
  const classroomPayload = await readJSON(classrooms)
  const classroomId = classroomPayload.data?.[0]?.id
  if (!classroomId) throw new Error('Teacher fixture returned no classroom for student list')
  const members = await page.request.get(`${baseURL}/api/classrooms/${classroomId}/members`)
  if (members.status() !== 200) throw new Error(`Expected classroom members 200, received ${members.status()}`)
  const membersPayload = await readJSON(members)
  if (!Array.isArray(membersPayload.data) || membersPayload.data.length === 0) throw new Error('Teacher classroom members did not read back')
  await page.goto(`${baseURL}/guru/siswa`)
  await page.getByRole('heading', { name: 'Daftar Siswa', exact: true }).waitFor()
  await page.getByText(membersPayload.data[0].name, { exact: true }).first().waitFor()

  await page.goto(`${baseURL}/guru/pengaturan`)
  await page.getByRole('heading', { name: 'Pengaturan', exact: true }).waitFor()
  const settingsBody = await page.locator('main').innerText()
  if (!/Google Drive/i.test(settingsBody)) throw new Error('Teacher settings did not render Google Drive integration')

  const preferences = await page.request.get(`${baseURL}/api/teacher/preferences`)
  if (preferences.status() !== 200) throw new Error(`Expected teacher preferences 200, received ${preferences.status()}`)
  const savedPreferences = { submissions: false, lowScore: true, weekly: true, device: false }
  const preferenceUpdate = await page.request.patch(`${baseURL}/api/teacher/preferences`, { data: savedPreferences })
  if (preferenceUpdate.status() !== 200) throw new Error(`Expected teacher preferences update 200, received ${preferenceUpdate.status()}`)
  const preferenceReadBack = await (await page.request.get(`${baseURL}/api/teacher/preferences`)).json()
  if (JSON.stringify(preferenceReadBack.data) !== JSON.stringify(savedPreferences)) {
    throw new Error(`Teacher preferences did not read back: ${JSON.stringify(preferenceReadBack)}`)
  }

  const driveStatus = await page.request.get(`${baseURL}/api/integrations/google-drive/status`)
  if (![200, 501].includes(driveStatus.status())) {
    throw new Error(`Expected Drive status 200 or explicit 501 configuration gate, received ${driveStatus.status()}`)
  }
  const drivePayload = await readJSON(driveStatus)
  if (driveStatus.status() === 200 && typeof drivePayload.data?.connected !== 'boolean') {
    throw new Error('Drive status response did not expose a boolean connected field')
  }
  if (driveStatus.status() === 501 && drivePayload.error?.code !== 'DRIVE_NOT_CONFIGURED') {
    throw new Error(`Drive configuration failure was not explicit: ${JSON.stringify(drivePayload)}`)
  }

  const uploadWithoutFile = await page.request.post(`${baseURL}/api/integrations/google-drive/upload`, {
    multipart: { assignmentId: 'missing-file-assignment' },
  })
  if (uploadWithoutFile.status() !== 400) {
    throw new Error(`Expected missing Drive upload fields to return 400, received ${uploadWithoutFile.status()}`)
  }

  await page.goto(`${baseURL}/guru/perangkat`)
  await page.getByRole('heading', { name: 'Perangkat TuturAI', exact: true }).waitFor()
  await page.getByText('Belum ada perangkat yang terdaftar.', { exact: true }).waitFor()
  const deviceList = await page.request.get(`${baseURL}/api/teacher/devices`)
  if (deviceList.status() !== 200) throw new Error(`Expected teacher device list 200, received ${deviceList.status()}`)
  const devicePayload = await readJSON(deviceList)
  if (!Array.isArray(devicePayload.data)) throw new Error('Device list response was not an array')

  const invalidRegistration = await page.request.post(`${baseURL}/api/teacher/devices`, {
    data: { deviceId: 'x' },
  })
  if (invalidRegistration.status() !== 400) {
    throw new Error(`Expected invalid device registration to return 400, received ${invalidRegistration.status()}`)
  }

  const missingRemoval = await page.request.delete(`${baseURL}/api/teacher/devices?deviceId=missing-device-01`)
  if (missingRemoval.status() !== 404) {
    throw new Error(`Expected removal of missing device to return 404, received ${missingRemoval.status()}`)
  }

  console.log(JSON.stringify({
    ok: true,
    driveStatus: driveStatus.status(),
    preferences: 'read-back',
    leaderboard: 'xp-order-and-ui-route',
    studentList: 'members-read-back-and-ui-route',
    uploadValidationStatus: uploadWithoutFile.status(),
    deviceCount: devicePayload.data.length,
    deviceValidationStatus: invalidRegistration.status(),
    missingDeviceRemovalStatus: missingRemoval.status(),
  }))
} finally {
  await context.close()
  await browser.close()
}
