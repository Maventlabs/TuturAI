import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'
import { completeDriveOAuth } from '@/lib/drive'

vi.mock('@/lib/drive', () => ({
  completeDriveOAuth: vi.fn(),
  DriveConfigurationError: class DriveConfigurationError extends Error {},
}))

const mockedCompleteOAuth = vi.mocked(completeDriveOAuth)

function callbackRequest(query = 'state=state-fixture&code=code-fixture') {
  return new NextRequest(`https://tuturai-apps.netlify.app/api/integrations/google-drive/callback?${query}`)
}

describe('GET /api/integrations/google-drive/callback', () => {
  beforeEach(() => vi.resetAllMocks())

  it('redirects after a completed OAuth code exchange', async () => {
    mockedCompleteOAuth.mockResolvedValue('teacher-123')
    const response = await GET(callbackRequest())
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://tuturai-apps.netlify.app/guru/pengaturan?drive=connected')
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
})
