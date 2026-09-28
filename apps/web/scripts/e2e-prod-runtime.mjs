import { randomUUID } from 'node:crypto'
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { chromium } from 'playwright'

function safeErrorCode(payload) {
  const code = payload?.error?.details?.code ?? payload?.error?.code
  return typeof code === 'string' && /^[A-Z0-9_]{1,64}$/.test(code) ? code : null
}

export function logProdE2ERequest({ requestId, route, status, errorCode, provider, durationMs }) {
  console.log(JSON.stringify({
    event: 'production_e2e_request',
    requestId: typeof requestId === 'string' ? requestId.slice(0, 128) : null,
    route,
    status,
    errorCode: typeof errorCode === 'string' ? errorCode : null,
    provider: typeof provider === 'string' ? provider : null,
    durationMs: Math.max(0, Math.round(durationMs)),
  }))
}

export function createAdminClient(config) {
  if (!config.admin) throw new Error('This production E2E suite requires Firebase Admin read-back credentials.')
  const app = initializeApp({
    credential: cert({
      projectId: config.admin.projectId,
      clientEmail: config.admin.clientEmail,
      privateKey: config.admin.privateKey,
    }),
    projectId: config.admin.projectId,
  }, `tuturai-prod-e2e-${randomUUID()}`)
  return { app, auth: getAuth(app), db: getFirestore(app) }
}

export async function verifyDedicatedIdentity(auth, db, identity, expectedRole) {
  const user = await auth.getUser(identity.uid)
  if (user.email?.toLowerCase() !== identity.email.toLowerCase()) {
    throw new Error(`${expectedRole} E2E UID does not belong to the configured dedicated E2E email.`)
  }
  const profile = await db.collection('users').doc(user.uid).get()
  if (!profile.exists || profile.data()?.role !== expectedRole) {
    throw new Error(`Dedicated ${expectedRole} E2E profile is missing or has the wrong permanent role.`)
  }
  return user.uid
}

export async function launchProdBrowser(config, options = {}) {
  const browser = await chromium.launch({
    headless: options.headless ?? config.headless,
    ...(options.args ? { args: options.args } : {}),
  })
  const context = await browser.newContext({
    acceptDownloads: true,
    ...(options.permissions ? { permissions: options.permissions } : {}),
  })
  return { browser, context, page: await context.newPage() }
}

export async function waitForApiResponse(page, pathname, method, action, provider = null) {
  const startedAt = performance.now()
  const responsePromise = page.waitForResponse((response) => {
    const request = response.request()
    return new URL(response.url()).pathname === pathname && request.method() === method
  })
  await action()
  const response = await responsePromise
  const body = await response.json().catch(() => null)
  logProdE2ERequest({
    requestId: response.headers()['x-request-id'] ?? response.headers()['x-nf-request-id'] ?? null,
    route: pathname,
    status: response.status(),
    errorCode: safeErrorCode(body),
    provider,
    durationMs: performance.now() - startedAt,
  })
  return { response, body }
}

export async function requestJson(page, baseUrl, path, options = {}, provider = null) {
  const startedAt = performance.now()
  const response = await page.request.fetch(new URL(path, baseUrl).toString(), options)
  const body = await response.json().catch(() => null)
  logProdE2ERequest({
    requestId: response.headers()['x-request-id'] ?? response.headers()['x-nf-request-id'] ?? null,
    route: path,
    status: response.status(),
    errorCode: safeErrorCode(body),
    provider,
    durationMs: performance.now() - startedAt,
  })
  return { response, body }
}

export async function loginWithPassword(page, config, identity, expectedRole, options = {}) {
  await page.goto(new URL('/auth/login', config.baseUrl).toString())
  await page.getByLabel('Email').fill(identity.email)
  await page.getByLabel('Kata Sandi').fill(identity.password)
  const { response: sessionResponse } = await waitForApiResponse(
    page,
    '/api/auth/session',
    'POST',
    () => page.getByRole('button', { name: 'Masuk', exact: true }).click(),
    'firebase-admin',
  )
  if (sessionResponse.status() !== 200) throw new Error(`${expectedRole} login did not establish a server session (${sessionResponse.status()}).`)

  const rolePath = expectedRole === 'teacher' ? '/guru' : '/siswa'
  await page.waitForURL((url) => url.pathname === '/dashboard' || url.pathname.startsWith(rolePath), { timeout: 30_000 })
  if (options.navigateToRoleRoute !== false) await page.goto(new URL(rolePath, config.baseUrl).toString())

  const { response, body } = await requestJson(page, config.baseUrl, '/api/me', {}, 'firebase-admin')
  if (response.status() !== 200 || body?.data?.profile?.role !== expectedRole || body?.data?.profile?.id !== identity.uid) {
    throw new Error(`${expectedRole} /api/me response did not match the dedicated test identity.`)
  }
  await page.reload()
  await page.waitForURL((url) => url.pathname.startsWith(rolePath), { timeout: 30_000 })
  await page.locator('main').waitFor()
  return body.data.profile
}

export async function logoutAndAssertUnauthorized(page, config) {
  await page.getByRole('button', { name: 'Menu profil' }).click()
  await page.getByRole('menuitem', { name: 'Keluar' }).click()
  await page.waitForURL(new URL('/auth/login', config.baseUrl).toString(), { timeout: 30_000 })
  const { response, body } = await requestJson(page, config.baseUrl, '/api/me')
  if (response.status() !== 401 || !body?.error) {
    throw new Error(`Logout did not revoke the server session; /api/me returned ${response.status()}.`)
  }
}

export function trackCleanupRef(cleanupRefs, ref) {
  cleanupRefs.push(ref)
  return ref
}

export function trackCleanupAction(cleanupRefs, action) {
  cleanupRefs.push(action)
  return action
}

export async function cleanupTrackedDocuments(cleanupRefs) {
  const failures = []
  for (const cleanup of [...cleanupRefs].reverse()) {
    try {
      if (typeof cleanup === 'function') await cleanup()
      else await cleanup.delete()
    } catch {
      failures.push(typeof cleanup === 'function' ? 'tracked-cleanup-action' : cleanup.path)
    }
  }
  if (failures.length) throw new Error(`Production E2E cleanup failed for ${failures.length} exact test document(s).`)
}

export async function closeProdResources(resources, cleanupRefs = [], cleanupAfterRun = true) {
  const errors = []
  if (cleanupAfterRun) {
    try { await cleanupTrackedDocuments(cleanupRefs) } catch (error) { errors.push(error) }
  }
  try { await resources.context?.close() } catch (error) { errors.push(error) }
  try { await resources.browser?.close() } catch (error) { errors.push(error) }
  try { await resources.adminApp?.delete() } catch (error) { errors.push(error) }
  if (errors.length) throw new Error(`Production E2E cleanup failed in ${errors.length} operation(s).`)
}

export function attachAdmin(resources, adminClient) {
  resources.adminApp = adminClient.app
  resources.auth = adminClient.auth
  resources.db = adminClient.db
  return resources
}
