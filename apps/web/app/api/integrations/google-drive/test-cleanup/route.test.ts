import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { DELETE } from './route'
import { requireRole } from '@/lib/api/auth-guard'
import { deleteDriveFile } from '@/lib/drive'
import { getAdminDb } from '@/lib/firebase/admin'

const { requireRoleMock, deleteDriveFileMock, getAdminDbMock } = vi.hoisted(() => ({ requireRoleMock: vi.fn(), deleteDriveFileMock: vi.fn(), getAdminDbMock: vi.fn() }))
vi.mock('@/lib/api/auth-guard', () => ({ requireRole: requireRoleMock }))
vi.mock('@/lib/drive', () => ({ deleteDriveFile: deleteDriveFileMock }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: getAdminDbMock }))

const mockedRequireRole = vi.mocked(requireRole)
const mockedDeleteFile = vi.mocked(deleteDriveFile)
const mockedDb = vi.mocked(getAdminDb)
const fixtureFile = { id: 'drive-file-123', name: 'e2e-fixture.pdf', mimeType: 'application/pdf' }
const testPrefix = 'e2e-prod-20260926'

type FakeReference = {
  id: string
  get: () => Promise<{ id: string; exists: boolean; data: () => Record<string, unknown> | undefined }>
  update: (patch: Record<string, unknown>) => Promise<void>
}

function request(body: Record<string, unknown>) {
  return new NextRequest('https://tuturai-apps.netlify.app/api/integrations/google-drive/test-cleanup', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function fakeFirestore() {
  const data = new Map<string, Map<string, Record<string, unknown>>>([
    ['assignments', new Map([['assignment-123', { id: 'assignment-123', title: `${testPrefix} Assignment`, e2eTestPrefix: testPrefix, classId: 'class-123', attachments: [fixtureFile] }]])],
    ['classrooms', new Map([['class-123', { teacherId: 'teacher-123', status: 'active' }]])],
    ['submissions', new Map()],
    ['classMemberships', new Map()],
  ])
  const collectionData = (collection: string) => {
    if (!data.has(collection)) data.set(collection, new Map())
    return data.get(collection)!
  }
  const reference = (collection: string, id: string): FakeReference => ({
    id,
    get: async () => {
      const document = collectionData(collection).get(id)
      return { id, exists: Boolean(document), data: () => document }
    },
    update: async (patch: Record<string, unknown>) => {
      const current = collectionData(collection).get(id)
      if (!current) throw new Error('NOT_FOUND')
      collectionData(collection).set(id, { ...current, ...patch })
    },
  })
  return {
    data,
    db: {
      collection: (name: string) => ({ doc: (id: string) => reference(name, id) }),
      runTransaction: async (callback: (transaction: unknown) => Promise<unknown>) => callback({
        get: async (ref: FakeReference) => ref.get(),
        update: async (ref: FakeReference, patch: Record<string, unknown>) => ref.update(patch),
      } as never),
    },
  }
}

describe('DELETE /api/integrations/google-drive/test-cleanup', () => {
  let fake: ReturnType<typeof fakeFirestore>

  beforeEach(() => {
    vi.resetAllMocks()
    fake = fakeFirestore()
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'teacher-123' } } as never)
    mockedDb.mockReturnValue(fake.db as never)
    mockedDeleteFile.mockResolvedValue(undefined)
  })

  it('deletes one referenced E2E file and removes its Firestore attachment metadata', async () => {
    const response = await DELETE(request({ assignmentId: 'assignment-123', fileId: fixtureFile.id, testPrefix }))
    expect(response.status).toBe(200)
    expect(mockedDeleteFile).toHaveBeenCalledWith('teacher-123', fixtureFile.id, { allowMissingOperation: true })
    expect(fake.data.get('assignments')!.get('assignment-123')!.attachments).toEqual([])
    await expect(response.json()).resolves.toMatchObject({ data: { deleted: true, fileId: fixtureFile.id } })
  })

  it('refuses files outside the exact owner-tagged E2E assignment', async () => {
    const response = await DELETE(request({ assignmentId: 'assignment-123', fileId: fixtureFile.id, testPrefix: 'e2e-other-run' }))
    expect(response.status).toBe(404)
    expect(mockedDeleteFile).not.toHaveBeenCalled()
    expect(fake.data.get('assignments')!.get('assignment-123')!.attachments).toEqual([fixtureFile])
  })

  it('cleans a provider-created orphan only when its operation is owned by the same teacher', async () => {
    fake.data.get('assignments')!.get('assignment-123')!.attachments = []
    const uploadIdempotencyKey = 'a'.repeat(64)
    const operationId = createHash('sha256').update(`teacher-123:${uploadIdempotencyKey}`).digest('hex')
    fake.data.set('googleDriveUploadOperations', new Map([[operationId, { teacherId: 'teacher-123', driveFileId: fixtureFile.id, status: 'pending' }]]))

    const response = await DELETE(request({ assignmentId: 'assignment-123', fileId: fixtureFile.id, testPrefix, uploadIdempotencyKey }))
    expect(response.status).toBe(200)
    expect(mockedDeleteFile).toHaveBeenCalledWith('teacher-123', fixtureFile.id, { allowMissingOperation: true })
  })
})
