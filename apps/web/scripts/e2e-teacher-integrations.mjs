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

  await page.goto(`${baseURL}/guru/pengaturan`)
  await page.getByRole('heading', { name: 'Pengaturan', exact: true }).waitFor()
  const settingsBody = await page.locator('main').innerText()
  if (!/Google Drive/i.test(settingsBody)) throw new Error('Teacher settings did not render Google Drive integration')

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
    uploadValidationStatus: uploadWithoutFile.status(),
    deviceCount: devicePayload.data.length,
    deviceValidationStatus: invalidRegistration.status(),
    missingDeviceRemovalStatus: missingRemoval.status(),
  }))
} finally {
  await context.close()
  await browser.close()
}
