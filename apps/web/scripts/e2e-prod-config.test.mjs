import test from 'node:test'
import assert from 'node:assert/strict'
import { createProdE2EConfig } from './e2e-prod-config.mjs'

const base = {
  E2E_BASE_URL: 'https://tuturai-apps.netlify.app',
  E2E_FIREBASE_PROJECT_ID: 'gen-lang-client-0138449759',
  E2E_FIREBASE_ADMIN_PROJECT_ID: 'gen-lang-client-0138449759',
  E2E_FIREBASE_ADMIN_CLIENT_EMAIL: 'e2e-runner@gen-lang-client-0138449759.iam.gserviceaccount.com',
  E2E_FIREBASE_ADMIN_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nfixture\n-----END PRIVATE KEY-----',
  E2E_TEST_PREFIX: 'e2e-prod-20260926',
  E2E_TEST_DATA_APPROVED: 'true',
  E2E_STUDENT_EMAIL: 'e2e-student@example.test',
  E2E_STUDENT_PASSWORD: 'not-a-real-password',
  E2E_STUDENT_UID: 'e2e-student-uid',
  E2E_TEACHER_EMAIL: 'e2e-teacher@example.test',
  E2E_TEACHER_PASSWORD: 'not-a-real-teacher-password',
  E2E_TEACHER_UID: 'e2e-teacher-uid',
  E2E_CLASSROOM_ID: 'e2e-classroom-id',
}

test('smoke requires a real HTTPS Netlify deployment and does not need credentials', () => {
  const config = createProdE2EConfig('smoke', { E2E_BASE_URL: base.E2E_BASE_URL })
  assert.equal(config.baseUrl.origin, base.E2E_BASE_URL)
  assert.equal(config.projectId, null)
  assert.equal(config.admin, null)
})

test('protected suites reject missing config by variable name, without echoing values', () => {
  assert.throws(
    () => createProdE2EConfig('student', { E2E_BASE_URL: base.E2E_BASE_URL }),
    (error) => {
      assert.match(error.message, /E2E_STUDENT_EMAIL/)
      assert.match(error.message, /E2E_FIREBASE_ADMIN_PRIVATE_KEY/)
      assert.doesNotMatch(error.message, /not-a-real-password|fixture/)
      return true
    },
  )
})

test('production suites reject emulator settings even when credentials are present', () => {
  assert.throws(
    () => createProdE2EConfig('student', { ...base, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }),
    /FIRESTORE_EMULATOR_HOST/,
  )
})

test('production suites reject demo projects and non-Netlify local targets', () => {
  assert.throws(
    () => createProdE2EConfig('student', { ...base, E2E_FIREBASE_PROJECT_ID: 'demo-tuturai', E2E_FIREBASE_ADMIN_PROJECT_ID: 'demo-tuturai' }),
    /E2E_FIREBASE_PROJECT_ID/,
  )
  assert.throws(
    () => createProdE2EConfig('smoke', { E2E_BASE_URL: 'http://localhost:3000' }),
    /E2E_BASE_URL/,
  )
})

test('a provider suite fails rather than being reported as skipped', () => {
  assert.throws(
    () => createProdE2EConfig('drive', { ...base, E2E_DRIVE_ENABLED: 'false' }),
    /E2E_DRIVE_ENABLED=true/,
  )
})

test('Drive consent requires an approved dedicated account and a visible browser checkpoint', () => {
  assert.throws(
    () => createProdE2EConfig('drive', {
      ...base,
      E2E_DRIVE_ENABLED: 'true',
      E2E_DRIVE_ACCOUNT_EMAIL: 'drive-e2e@example.test',
      E2E_DRIVE_ACCOUNT_APPROVED: 'false',
      E2E_DRIVE_TEST_FILE: 'apps/web/scripts/e2e-prod-config.test.mjs',
      E2E_HEADLESS: 'false',
    }),
    /E2E_DRIVE_ACCOUNT_APPROVED=true/,
  )
  assert.throws(
    () => createProdE2EConfig('drive', {
      ...base,
      E2E_DRIVE_ENABLED: 'true',
      E2E_DRIVE_ACCOUNT_EMAIL: 'drive-e2e@example.test',
      E2E_DRIVE_ACCOUNT_APPROVED: 'true',
      E2E_DRIVE_TEST_FILE: 'apps/web/scripts/e2e-prod-config.test.mjs',
      E2E_HEADLESS: 'true',
    }),
    /E2E_HEADLESS=false/,
  )
})

test('test data mutations require an explicit approval marker and safe prefix', () => {
  assert.throws(
    () => createProdE2EConfig('classroom', { ...base, E2E_TEST_DATA_APPROVED: 'false' }),
    /E2E_TEST_DATA_APPROVED=true/,
  )
  assert.throws(
    () => createProdE2EConfig('classroom', { ...base, E2E_TEST_PREFIX: 'production' }),
    /E2E_TEST_PREFIX/,
  )
})
