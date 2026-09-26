import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createSessionCookie } from '@/lib/firebase/session'
import { POST } from './route'

vi.mock('@/lib/firebase/session', () => ({
  createSessionCookie: vi.fn(),
  SESSION_COOKIE: 'tuturai_session',
  SESSION_MAX_AGE_SECONDS: 60 * 60 * 24 * 5,
}))

const mockedCreateSessionCookie = vi.mocked(createSessionCookie)

function request(idToken = 'synthetic-test-token') {
  return new NextRequest('http://localhost/api/auth/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
}

describe('POST /api/auth/session', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns a session cookie after Firebase verifies the ID token', async () => {
    mockedCreateSessionCookie.mockResolvedValue('synthetic-session-cookie')

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('tuturai_session=synthetic-session-cookie')
    await expect(response.json()).resolves.toMatchObject({ data: { authenticated: true } })
  })

  it('returns a safe authentication error and logs only the Firebase error code', async () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mockedCreateSessionCookie.mockRejectedValue(Object.assign(
      new Error('raw token synthetic-test-token must not be logged'),
      { code: 'auth/invalid-id-token' },
    ))

    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error.details).toMatchObject({ code: 'FIREBASE_ID_TOKEN_REJECTED', firebaseErrorCode: 'auth/invalid-id-token' })
    const logs = JSON.stringify(logger.mock.calls)
    expect(logs).toContain('auth/invalid-id-token')
    expect(logs).not.toContain('synthetic-test-token')
    expect(logs).not.toContain('raw token')
    logger.mockRestore()
  })

  it('returns a server configuration error for missing Firebase Admin environment', async () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mockedCreateSessionCookie.mockRejectedValue(new Error('Missing required environment variable: FIREBASE_ADMIN_PROJECT_ID'))

    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error.details).toMatchObject({ code: 'FIREBASE_ADMIN_MISCONFIGURED' })
    expect(JSON.stringify(logger.mock.calls)).toContain('FIREBASE_ADMIN_PROJECT_ID')
    expect(JSON.stringify(logger.mock.calls)).not.toContain('synthetic-test-token')
    logger.mockRestore()
  })

  it('reports Firebase Admin network failures as retryable service unavailable', async () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mockedCreateSessionCookie.mockRejectedValue(Object.assign(new Error('network unavailable'), { code: 'app/network-error' }))

    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.error).toMatchObject({ code: 'EXTERNAL_SERVICE_ERROR', details: { code: 'FIREBASE_SERVICE_UNAVAILABLE', firebaseErrorCode: 'app/network-error' } })
    expect(JSON.stringify(logger.mock.calls)).not.toContain('synthetic-test-token')
    logger.mockRestore()
  })
})
