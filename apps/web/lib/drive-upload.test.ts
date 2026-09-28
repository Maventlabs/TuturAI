import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getAdminDb, getGoogleOAuthEnv } = vi.hoisted(() => ({ getAdminDb: vi.fn(), getGoogleOAuthEnv: vi.fn() }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb }))
vi.mock('@/lib/config/env', () => ({ getGoogleOAuthEnv }))

import { deleteDriveFile, ensureDriveFolderStructure, uploadDriveFile } from './drive'

const encryptionKey = 'drive-upload-test-encryption-key'
const accessToken = 'drive-access-token-fixture'
const teacherId = 'e2e-teacher-123'

type FakeReference = {
  collectionName: string
  id: string
  get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>
  create: (value: Record<string, unknown>) => Promise<void>
  update: (value: Record<string, unknown>) => Promise<void>
}

function encryptToken(token: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(encryptionKey).digest(), iv)
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`
}

function decryptToken(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split('.')
  const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(encryptionKey).digest(), Buffer.from(ivValue!, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagValue!, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue!, 'base64url')), decipher.final()]).toString('utf8')
}

function createFakeDb() {
  const stores = new Map<string, Map<string, Record<string, unknown>>>()
  const getStore = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map())
    return stores.get(name)!
  }
  const reference = (collectionName: string, id: string): FakeReference => ({
    collectionName,
    id,
    get: async () => {
      const value = getStore(collectionName).get(id)
      return { exists: Boolean(value), data: () => value }
    },
    create: async (value: Record<string, unknown>) => {
      if (getStore(collectionName).has(id)) throw new Error('ALREADY_EXISTS')
      getStore(collectionName).set(id, value)
    },
    update: async (value: Record<string, unknown>) => {
      const current = getStore(collectionName).get(id)
      if (!current) throw new Error('NOT_FOUND')
      getStore(collectionName).set(id, { ...current, ...value })
    },
  })
  const collection = (name: string) => ({
    doc: (id: string) => reference(name, id),
    where: () => ({ get: async () => ({ docs: [] }) }),
  })
  const db = {
    collection,
    runTransaction: async (action: (transaction: {
      get: (ref: FakeReference) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>
      create: (ref: FakeReference, data: Record<string, unknown>) => Promise<void>
      set: (ref: FakeReference, data: Record<string, unknown>) => Promise<void>
      update: (ref: FakeReference, data: Record<string, unknown>) => Promise<void>
    }) => Promise<unknown>) => action({
      get: async (ref) => ref.get(),
      create: async (ref, data) => ref.create(data!),
      set: async (ref, data) => { getStore(ref.collectionName).set(ref.id, data!) },
      update: async (ref, data) => ref.update(data!),
    }),
  }
  return { db, stores }
}

function uploadResponse(fileId = 'drive-file-e2e-123', name = 'worksheet.txt', appProperties: Record<string, string> = {}) {
  return new Response(JSON.stringify({ id: fileId, name, mimeType: 'text/plain', size: '3', webViewLink: 'https://drive.example.test/file', appProperties }), { status: 200 })
}

describe('uploadDriveFile', () => {
  let fake: ReturnType<typeof createFakeDb>

  beforeEach(() => {
    vi.resetAllMocks()
    fake = createFakeDb()
    fake.stores.set('googleDriveConnections', new Map([[teacherId, {
      accessToken: encryptToken(accessToken),
      refreshToken: encryptToken('refresh-token-fixture'),
      expiresAt: { toMillis: () => Date.now() + 300_000 },
    }]]))
    getAdminDb.mockReturnValue(fake.db as never)
    getGoogleOAuthEnv.mockReturnValue({ clientId: 'client', clientSecret: 'secret', redirectUri: 'https://example.test/callback', tokenEncryptionKey: encryptionKey })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('pre-generates a Drive file ID and replays a completed upload for the same intent', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ids: ['drive-file-e2e-123'] }), { status: 200 }))
      .mockImplementationOnce(async (_url, init) => {
        const requestBody = String(init?.body)
        expect(requestBody).toContain('"id":"drive-file-e2e-123"')
        expect(requestBody).toContain('tuturaiRequestHash')
        return uploadResponse()
      })
    const input = { teacherId, file: new Uint8Array([1, 2, 3]), name: 'worksheet.txt', mimeType: 'text/plain', folderId: 'folder-1', idempotencyKey: 'assignment-file-intent-1', fetchImpl }

    const first = await uploadDriveFile(input)
    const replay = await uploadDriveFile(input)

    expect(first).toEqual(replay)
    expect(first.id).toBe('drive-file-e2e-123')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect([...fake.stores.get('googleDriveUploadOperations')!.values()][0]?.status).toBe('completed')
  })

  it('recovers a provider-created file after an uncertain response without creating a duplicate', async () => {
    const requestHash = createHash('sha256')
      .update(teacherId).update('\0').update('folder-1').update('\0').update('worksheet.txt').update('\0').update('text/plain').update('\0').update(new Uint8Array([1, 2, 3]))
      .digest('hex')
    fake.stores.set('googleDriveUploadOperations', new Map([['operation-key-hash', {
      teacherId,
      requestHash,
      driveFileId: 'drive-file-e2e-123',
      status: 'pending',
      createdAt: new Date(),
    }]]))
    // Use the real deterministic operation id for this test's key.
    const operationId = createHash('sha256').update(`${teacherId}:assignment-file-intent-1`).digest('hex')
    fake.stores.get('googleDriveUploadOperations')!.delete('operation-key-hash')
    fake.stores.get('googleDriveUploadOperations')!.set(operationId, {
      teacherId,
      requestHash,
      driveFileId: 'drive-file-e2e-123',
      status: 'pending',
      createdAt: new Date(),
    })
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('already created', { status: 409 }))
      .mockResolvedValueOnce(uploadResponse('drive-file-e2e-123', 'worksheet.txt', { tuturaiRequestHash: requestHash }))

    const file = await uploadDriveFile({ teacherId, file: new Uint8Array([1, 2, 3]), name: 'worksheet.txt', mimeType: 'text/plain', folderId: 'folder-1', idempotencyKey: 'assignment-file-intent-1', fetchImpl })
    expect(file.id).toBe('drive-file-e2e-123')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fake.stores.get('googleDriveUploadOperations')!.get(operationId)?.status).toBe('completed')
  })

  it('rejects reuse of an idempotency key with different file bytes', async () => {
    const firstFetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ids: ['drive-file-e2e-123'] }), { status: 200 }))
      .mockResolvedValueOnce(uploadResponse())
    await uploadDriveFile({ teacherId, file: new Uint8Array([1, 2, 3]), name: 'worksheet.txt', mimeType: 'text/plain', folderId: 'folder-1', idempotencyKey: 'same-upload-intent', fetchImpl: firstFetch })
    const secondFetch = vi.fn<typeof fetch>()

    await expect(uploadDriveFile({ teacherId, file: new Uint8Array([9, 9, 9]), name: 'worksheet.txt', mimeType: 'text/plain', folderId: 'folder-1', idempotencyKey: 'same-upload-intent', fetchImpl: secondFetch })).rejects.toThrow('DRIVE_IDEMPOTENCY_KEY_REUSED')
    expect(secondFetch).not.toHaveBeenCalled()
  })

  it('encrypts and stores a rotated refresh token when the provider returns one', async () => {
    fake.stores.get('googleDriveConnections')!.set(teacherId, {
      accessToken: encryptToken('expired-access-token'),
      refreshToken: encryptToken('old-refresh-token'),
      expiresAt: { toMillis: () => Date.now() - 60_000 },
    })
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'new-access-token', refresh_token: 'rotated-refresh-token', expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ids: ['drive-file-e2e-123'] }), { status: 200 }))
      .mockResolvedValueOnce(uploadResponse())

    await uploadDriveFile({ teacherId, file: new Uint8Array([1, 2, 3]), name: 'worksheet.txt', mimeType: 'text/plain', folderId: 'folder-1', idempotencyKey: 'rotated-refresh-intent', fetchImpl })

    const connection = fake.stores.get('googleDriveConnections')!.get(teacherId)!
    expect(decryptToken(String(connection.refreshToken))).toBe('rotated-refresh-token')
    expect(decryptToken(String(connection.accessToken))).toBe('new-access-token')
  })

  it('requires teacher reauthorization when Google revokes the refresh token', async () => {
    fake.stores.get('googleDriveConnections')!.set(teacherId, {
      accessToken: encryptToken('expired-access-token'),
      refreshToken: encryptToken('revoked-refresh-token'),
      expiresAt: { toMillis: () => Date.now() - 60_000 },
    })
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }))

    await expect(uploadDriveFile({ teacherId, file: new Uint8Array([1, 2, 3]), name: 'worksheet.txt', mimeType: 'text/plain', idempotencyKey: 'revoked-refresh-intent', fetchImpl })).rejects.toThrow('DRIVE_REAUTH_REQUIRED')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fake.stores.get('googleDriveUploadOperations')?.size ?? 0).toBe(0)
  })

  it('keeps temporary refresh outages retryable without issuing a Drive upload', async () => {
    fake.stores.get('googleDriveConnections')!.set(teacherId, {
      accessToken: encryptToken('expired-access-token'),
      refreshToken: encryptToken('refresh-token-fixture'),
      expiresAt: { toMillis: () => Date.now() - 60_000 },
    })
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('provider unavailable', { status: 503 }))

    await expect(uploadDriveFile({ teacherId, file: new Uint8Array([1, 2, 3]), name: 'worksheet.txt', mimeType: 'text/plain', idempotencyKey: 'refresh-outage-intent', fetchImpl })).rejects.toThrow('DRIVE_PROVIDER_UNAVAILABLE')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fake.stores.get('googleDriveUploadOperations')?.size ?? 0).toBe(0)
  })

  it('creates teacher/class/assignment/submission folders with the expected parent boundaries', async () => {
    const ids = ['folder-root-123', 'folder-class-123', 'folder-assignment-123', 'folder-submission-123', 'folder-student-123']
    const names: string[] = []
    const parents: Array<string[] | undefined> = []
    let nextId = 0
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
      if (init?.method === 'POST') {
        const folder = JSON.parse(String(init.body)) as { name: string; parents?: string[] }
        names.push(folder.name)
        parents.push(folder.parents)
        return new Response(JSON.stringify({ id: ids[nextId++] }), { status: 200 })
      }
      return new Response(JSON.stringify({ files: [] }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchImpl)

    const folders = await ensureDriveFolderStructure({ teacherId, classroomId: 'class-123', assignmentId: 'assignment-123', studentId: 'student-123' })

    expect(folders).toEqual({ root: ids[0], classroom: ids[1], assignment: ids[2], submission: ids[3], student: ids[4] })
    expect(names).toEqual(['TuturAI', 'class-class-123', 'assignment-assignment-123', 'submission', 'student-student-123'])
    expect(parents).toEqual([undefined, [ids[0]], [ids[1]], [ids[2]], [ids[3]]])
  })

  it('refuses to delete a Drive file without an upload operation owned by that teacher', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchImpl)
    await expect(deleteDriveFile(teacherId, 'drive-file-unowned-123')).rejects.toThrow('DRIVE_FILE_NOT_OWNED')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
