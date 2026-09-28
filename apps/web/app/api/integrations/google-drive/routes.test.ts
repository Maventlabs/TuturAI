import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as getStart } from './start/route'
import { GET as getStatus } from './status/route'
import { requireRole } from '@/lib/api/auth-guard'
import { consumeApiRateLimit, rateLimitResponse } from '@/lib/api/rate-limit'
import { createDriveOAuthState, getDriveConnectionStatus } from '@/lib/drive'

vi.mock('@/lib/api/auth-guard', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/api/rate-limit', () => ({ consumeApiRateLimit: vi.fn(), rateLimitResponse: vi.fn() }))
vi.mock('@/lib/drive', () => ({
  createDriveOAuthState: vi.fn(),
  getDriveConnectionStatus: vi.fn(),
  DriveConfigurationError: class DriveConfigurationError extends Error {},
}))

const mockedRequireRole = vi.mocked(requireRole)
const mockedConsumeLimit = vi.mocked(consumeApiRateLimit)
const mockedRateLimitResponse = vi.mocked(rateLimitResponse)
const mockedCreateState = vi.mocked(createDriveOAuthState)
const mockedGetStatus = vi.mocked(getDriveConnectionStatus)

describe('Google Drive start/status routes', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'teacher-123' } } as never)
    mockedConsumeLimit.mockResolvedValue({ remaining: 9, resetAt: Date.now() + 60_000 })
    mockedRateLimitResponse.mockReturnValue(null)
    mockedCreateState.mockResolvedValue('https://accounts.google.com/o/oauth2/v2/auth?scope=drive.file')
    mockedGetStatus.mockResolvedValue({ connected: true, scope: 'https://www.googleapis.com/auth/drive.file', updatedAt: null })
  })

  it('starts the separate Drive OAuth flow for the authenticated teacher', async () => {
    const response = await getStart(new NextRequest('https://tuturai-apps.netlify.app/api/integrations/google-drive/start'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('https://accounts.google.com/o/oauth2/v2/auth')
    expect(response.headers.get('location')).toContain('drive.file')
    expect(mockedConsumeLimit).toHaveBeenCalledWith({ scope: 'drive-oauth', subject: 'teacher-123', limit: 10, windowMs: 60 * 60 * 1_000 })
  })

  it('reads the authenticated teacher connection status from the server', async () => {
    const response = await getStatus(new NextRequest('https://tuturai-apps.netlify.app/api/integrations/google-drive/status'))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ data: { connected: true, scope: 'https://www.googleapis.com/auth/drive.file' } })
  })

  it('returns a JSON error instead of an empty 500 if saving OAuth state fails', async () => {
    mockedCreateState.mockRejectedValue(new Error('FIRESTORE_UNAVAILABLE'))
    const response = await getStart(new NextRequest('https://tuturai-apps.netlify.app/api/integrations/google-drive/start'))
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ error: { details: { code: 'DRIVE_OAUTH_START_FAILED' } } })
  })

  it('returns a JSON error instead of an empty 500 if the status read fails', async () => {
    mockedGetStatus.mockRejectedValue(new Error('FIRESTORE_UNAVAILABLE'))
    const response = await getStatus(new NextRequest('https://tuturai-apps.netlify.app/api/integrations/google-drive/status'))
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ error: { details: { code: 'DRIVE_STATUS_FAILED' } } })
  })
})
