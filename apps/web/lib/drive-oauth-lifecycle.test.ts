import { createDecipheriv, createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getAdminDb, getGoogleOAuthEnv } = vi.hoisted(() => ({ getAdminDb: vi.fn(), getGoogleOAuthEnv: vi.fn() }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb }))
vi.mock('@/lib/config/env', () => ({ getGoogleOAuthEnv }))

import { completeDriveOAuth, createDriveOAuthState, DRIVE_SCOPE, getDriveConnectionStatus } from './drive'

const encryptionKey = 'drive-oauth-test-encryption-key'

function decryptToken(value: string) {
  const [iv, tag, ciphertext] = value.split('.')
  const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(encryptionKey).digest(), Buffer.from(iv!, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag!, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(ciphertext!, 'base64url')), decipher.final()]).toString('utf8')
}

function fakeFirestore() {
  const collections = new Map<string, Map<string, Record<string, unknown>>>()
  const getCollection = (name: string) => {
    if (!collections.has(name)) collections.set(name, new Map())
    return collections.get(name)!
  }
  const db = {
    collection: (name: string) => ({
      doc: (id: string) => ({
        create: async (data: Record<string, unknown>) => {
          if (getCollection(name).has(id)) throw new Error('ALREADY_EXISTS')
          getCollection(name).set(id, data)
        },
        get: async () => {
          const data = getCollection(name).get(id)
          return { id, exists: Boolean(data), data: () => data }
        },
        delete: async () => { getCollection(name).delete(id) },
        set: async (data: Record<string, unknown>) => { getCollection(name).set(id, data) },
      }),
    }),
  }
  return { db, collections }
}

describe('Google Drive OAuth lifecycle', () => {
  let fake: ReturnType<typeof fakeFirestore>

  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    fake = fakeFirestore()
    getAdminDb.mockReturnValue(fake.db as never)
    getGoogleOAuthEnv.mockReturnValue({
      clientId: 'drive-client-id',
      clientSecret: 'drive-client-secret',
      redirectUri: 'https://tuturai-apps.netlify.app/api/integrations/google-drive/callback',
      tokenEncryptionKey: encryptionKey,
    })
  })

  it('creates a Drive-only PKCE authorization request and stores a short-lived encrypted state', async () => {
    const authorizationUrl = new URL(await createDriveOAuthState('teacher-123'))
    const state = authorizationUrl.searchParams.get('state')!
    const document = fake.collections.get('googleDriveOAuthStates')!.get(state)!
    const verifier = decryptToken(String(document.codeVerifier))

    expect(authorizationUrl.origin).toBe('https://accounts.google.com')
    expect(authorizationUrl.searchParams.get('scope')).toBe(DRIVE_SCOPE)
    expect(authorizationUrl.searchParams.get('access_type')).toBe('offline')
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256')
    expect(authorizationUrl.searchParams.get('code_challenge')).toBe(createHash('sha256').update(verifier).digest('base64url'))
    expect(document.teacherId).toBe('teacher-123')
    expect(String(document.codeVerifier)).not.toBe(verifier)
  })

  it('exchanges a single-use callback code and stores encrypted tokens for the owning teacher', async () => {
    const url = new URL(await createDriveOAuthState('teacher-456'))
    const state = url.searchParams.get('state')!
    const verifier = decryptToken(String(fake.collections.get('googleDriveOAuthStates')!.get(state)!.codeVerifier))
    const fetchMock = vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'access-token-fixture', refresh_token: 'refresh-token-fixture', expires_in: 3600 }), { status: 200 }))

    await expect(completeDriveOAuth(state, 'one-use-code')).resolves.toBe('teacher-456')
    const request = fetchMock.mock.calls[0]
    const body = new URLSearchParams(String(request?.[1]?.body))
    const connection = fake.collections.get('googleDriveConnections')!.get('teacher-456')!

    expect(request?.[0]).toBe('https://oauth2.googleapis.com/token')
    expect(body.get('code')).toBe('one-use-code')
    expect(body.get('code_verifier')).toBe(verifier)
    expect(body.get('redirect_uri')).toBe('https://tuturai-apps.netlify.app/api/integrations/google-drive/callback')
    expect(connection.scope).toBe(DRIVE_SCOPE)
    expect(decryptToken(String(connection.accessToken))).toBe('access-token-fixture')
    expect(decryptToken(String(connection.refreshToken))).toBe('refresh-token-fixture')
    await expect(getDriveConnectionStatus('teacher-456')).resolves.toMatchObject({ connected: true, scope: DRIVE_SCOPE })
    await expect(completeDriveOAuth(state, 'one-use-code')).rejects.toThrow('INVALID_OAUTH_STATE')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not save credentials when the provider omits a refresh token', async () => {
    const url = new URL(await createDriveOAuthState('teacher-789'))
    const state = url.searchParams.get('state')!
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'access-only' }), { status: 200 }))

    await expect(completeDriveOAuth(state, 'one-use-code')).rejects.toThrow('DRIVE_REFRESH_TOKEN_MISSING')
    expect(fake.collections.get('googleDriveConnections')?.get('teacher-789')).toBeUndefined()
  })
})
