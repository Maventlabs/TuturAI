import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'
import { completeDriveOAuth } from '@/lib/drive'
import { requireRole } from '@/lib/api/auth-guard'

vi.mock('@/lib/drive', () => ({
  completeDriveOAuth: vi.fn(),
  DriveConfigurationError: class DriveConfigurationError extends Error {},
}))
vi.mock('@/lib/api/auth-guard', () => ({ requireRole: vi.fn() }))

const mockedCompleteOAuth = vi.mocked(completeDriveOAuth)
const mockedRequireRole = vi.mocked(requireRole)

function callbackRequest(query = 'state=state-fixture&code=code-fixture') {
  return new NextRequest(`https://tuturai-apps.netlify.app/api/integrations/google-drive/callback?${query}`)
}

function teacherAuth(uid = 'teacher-123') {
  return { ok: true as const, user: { uid, role: 'teacher' as const } } as never
}

function deniedAuth() {
  return { ok: false as const, response: Response.json({ error: { code: 'UNAUTHENTICATED', message: 'no session' } }, { status: 401 }) } as never
}

describe('GET /api/integrations/google-drive/callback', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedRequireRole.mockResolvedValue(teacherAuth())
  })

  it('redirects after a completed OAuth code exchange', async () => {
    mockedCompleteOAuth.mockResolvedValue('teacher-123')
    const response = await GET(callbackRequest())
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://tuturai-apps.netlify.app/guru/pengaturan?drive=connected')
  })

  it('binds the exchange to the authenticated teacher session', async () => {
    mockedCompleteOAuth.mockResolvedValue('teacher-123')
    await GET(callbackRequest())
    expect(mockedCompleteOAuth).toHaveBeenCalledWith('state-fixture', 'code-fixture', 'teacher-123')
  })

  it('refuses the callback when the caller has no teacher session', async () => {
    mockedRequireRole.mockResolvedValue(deniedAuth())
    const response = await GET(callbackRequest())

    expect(response.status).toBe(401)
    // The OAuth exchange must never run for an unauthenticated caller.
    expect(mockedCompleteOAuth).not.toHaveBeenCalled()
  })

  it('rejects a non-teacher session before touching the provider', async () => {
    mockedRequireRole.mockResolvedValue(deniedAuth())
    const response = await GET(callbackRequest('state=s&code=c'))

    expect(response.status).toBe(401)
    expect(mockedCompleteOAuth).not.toHaveBeenCalled()
  })

  it('returns a retryable JSON error when Google is temporarily unavailable', async () => {
    mockedCompleteOAuth.mockRejectedValue(new Error('DRIVE_REQUEST_TIMEOUT'))
    const response = await GET(callbackRequest())
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({ error: { details: { code: 'DRIVE_REQUEST_TIMEOUT', retryable: true } } })
  })

  it('rejects an invalid OAuth state without exposing provider details', async () => {
    mockedCompleteOAuth.mockRejectedValue(new Error('INVALID_OAUTH_STATE'))
    const response = await GET(callbackRequest())
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: { details: { code: 'INVALID_OAUTH_STATE' } } })
  })

  it('rejects a callback missing state or code', async () => {
    const response = await GET(callbackRequest('state=only-state'))
    expect(response.status).toBe(400)
    expect(mockedCompleteOAuth).not.toHaveBeenCalled()
  })
})