import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getAdminDb, getGoogleOAuthEnv } = vi.hoisted(() => ({ getAdminDb: vi.fn(), getGoogleOAuthEnv: vi.fn() }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb }))
vi.mock('@/lib/config/env', () => ({ getGoogleOAuthEnv }))

import { disconnectDrive } from './drive'

function encryptToken(token: string, key: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(key).digest(), iv)
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`
}

describe('disconnectDrive', () => {
  const encryptionKey = 'e2e-drive-encryption-key'
  const refreshToken = 'refresh-token-private-fixture'
  const deleted = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })))
    getGoogleOAuthEnv.mockReturnValue({ clientId: 'client-id', clientSecret: 'client-secret', redirectUri: 'https://example.test/callback', tokenEncryptionKey: encryptionKey })
    getAdminDb.mockReturnValue({
      collection: () => ({
        doc: () => ({
          get: async () => ({ exists: true, data: () => ({ refreshToken: encryptToken(refreshToken, encryptionKey) }) }),
          delete: deleted,
        }),
      }),
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('revokes the encrypted refresh token before clearing the local connection', async () => {
    await disconnectDrive('teacher-e2e')
    const request = vi.mocked(fetch).mock.calls[0]
    expect(request?.[0]).toBe('https://oauth2.googleapis.com/revoke')
    expect(String(request?.[1]?.body)).toContain('refresh-token-private-fixture')
    expect(deleted).toHaveBeenCalledTimes(1)
  })

  it('keeps encrypted credentials when Google cannot confirm revocation', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
    await expect(disconnectDrive('teacher-e2e')).rejects.toThrow('DRIVE_TOKEN_REVOKE_FAILED')
    expect(deleted).not.toHaveBeenCalled()
  })

  it('clears local credentials for a token Google already considers revoked', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('invalid token', { status: 400 }))
    await expect(disconnectDrive('teacher-e2e')).resolves.toBeUndefined()
    expect(deleted).toHaveBeenCalledTimes(1)
  })
})
