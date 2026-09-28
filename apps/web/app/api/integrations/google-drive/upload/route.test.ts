import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'
import { requireRole } from '@/lib/api/auth-guard'
import { consumeApiRateLimit, rateLimitResponse } from '@/lib/api/rate-limit'
import { appendAssignmentAttachment, getTeacherAssignmentDriveContext } from '@/lib/assignments'
import { deleteDriveFile, ensureDriveFolderStructure, uploadDriveFile } from '@/lib/drive'

vi.mock('@/lib/api/auth-guard', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/api/rate-limit', () => ({ consumeApiRateLimit: vi.fn(), rateLimitResponse: vi.fn() }))
vi.mock('@/lib/assignments', () => ({ appendAssignmentAttachment: vi.fn(), getTeacherAssignmentDriveContext: vi.fn() }))
vi.mock('@/lib/drive', () => ({
  DriveConfigurationError: class DriveConfigurationError extends Error {},
  deleteDriveFile: vi.fn(),
  ensureDriveFolderStructure: vi.fn(),
  uploadDriveFile: vi.fn(),
  validateDriveFile: vi.fn(({ name, mimeType, size }: { name: string; mimeType: string; size: number }) => {
    if (mimeType !== 'text/plain' || !name.endsWith('.txt') || size < 1 || size > 25 * 1024 * 1024) throw new Error('UNSUPPORTED_FILE_TYPE')
    return { name, mimeType, size }
  }),
}))

const mockedRequireRole = vi.mocked(requireRole)
const mockedConsumeLimit = vi.mocked(consumeApiRateLimit)
const mockedRateLimitResponse = vi.mocked(rateLimitResponse)
const mockedAppendAttachment = vi.mocked(appendAssignmentAttachment)
const mockedAssignmentContext = vi.mocked(getTeacherAssignmentDriveContext)
const mockedDeleteFile = vi.mocked(deleteDriveFile)
const mockedEnsureFolders = vi.mocked(ensureDriveFolderStructure)
const mockedUploadFile = vi.mocked(uploadDriveFile)

function uploadRequest(file: File = new File(['worksheet'], 'worksheet.txt', { type: 'text/plain' })) {
  const form = new FormData()
  form.set('assignmentId', 'assignment-e2e-123')
  form.set('file', file)
  return new NextRequest('https://tuturai-apps.netlify.app/api/integrations/google-drive/upload', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'teacher-assignment-file-1' },
    body: form,
  })
}

describe('POST /api/integrations/google-drive/upload', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'teacher-123' } } as never)
    mockedConsumeLimit.mockResolvedValue({ remaining: 19, resetAt: Date.now() + 60_000 })
    mockedRateLimitResponse.mockReturnValue(null)
    mockedAssignmentContext.mockResolvedValue({ classroomId: 'class-123', assignment: { id: 'assignment-e2e-123' } } as never)
    mockedEnsureFolders.mockResolvedValue({ assignment: 'folder-assignment-123' } as never)
    mockedUploadFile.mockResolvedValue({ id: 'drive-file-123', name: 'worksheet.txt', mimeType: 'text/plain' })
    mockedAppendAttachment.mockResolvedValue({ id: 'assignment-e2e-123', attachments: [{ id: 'drive-file-123' }] } as never)
  })

  it('validates file metadata before Drive folder or provider work', async () => {
    const response = await POST(uploadRequest(new File(['malware'], 'payload.exe', { type: 'application/x-msdownload' })))
    expect(response.status).toBe(400)
    expect(mockedAssignmentContext).not.toHaveBeenCalled()
    expect(mockedEnsureFolders).not.toHaveBeenCalled()
    expect(mockedUploadFile).not.toHaveBeenCalled()
  })

  it('uploads to the teacher assignment folder and persists assignment metadata', async () => {
    const response = await POST(uploadRequest())
    expect(response.status).toBe(201)
    expect(mockedAssignmentContext).toHaveBeenCalledWith('assignment-e2e-123', 'teacher-123')
    expect(mockedEnsureFolders).toHaveBeenCalledWith({ teacherId: 'teacher-123', classroomId: 'class-123', assignmentId: 'assignment-e2e-123' })
    expect(mockedUploadFile).toHaveBeenCalledWith(expect.objectContaining({ teacherId: 'teacher-123', folderId: 'folder-assignment-123', idempotencyKey: 'teacher-assignment-file-1' }))
    expect(mockedAppendAttachment).toHaveBeenCalledWith('assignment-e2e-123', 'teacher-123', expect.objectContaining({ id: 'drive-file-123' }))
    await expect(response.json()).resolves.toMatchObject({ data: { file: { id: 'drive-file-123' }, assignment: { id: 'assignment-e2e-123' } } })
  })

  it('compensates a Drive upload when Firestore metadata persistence fails', async () => {
    mockedAppendAttachment.mockRejectedValue(new Error('FIRESTORE_UNAVAILABLE'))
    const response = await POST(uploadRequest())
    expect(response.status).toBe(503)
    expect(mockedDeleteFile).toHaveBeenCalledWith('teacher-123', 'drive-file-123')
    await expect(response.json()).resolves.toMatchObject({ error: { details: { code: 'DRIVE_METADATA_PERSISTENCE_FAILED', retryable: true } } })
  })

  it('returns a retryable JSON error when the provider times out', async () => {
    mockedUploadFile.mockRejectedValue(new Error('DRIVE_REQUEST_TIMEOUT'))
    const response = await POST(uploadRequest())
    expect(response.status).toBe(502)
    expect(mockedAppendAttachment).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({ error: { details: { code: 'DRIVE_REQUEST_TIMEOUT', retryable: true } } })
  })
})
