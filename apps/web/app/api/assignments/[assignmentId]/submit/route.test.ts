import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { DomainRuleError } from '@tuturai/domain'
import { POST } from './route'
import { requireRole } from '@/lib/api/auth-guard'
import { appendSubmissionFile, submitAssignment } from '@/lib/submissions'
import { deleteDriveFile, ensureDriveFolderStructure, uploadDriveFile } from '@/lib/drive'
import { getStudentAssignmentDriveContext } from '@/lib/assignments'
import { consumeApiRateLimit, rateLimitResponse } from '@/lib/api/rate-limit'

vi.mock('@/lib/api/auth-guard', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/submissions', () => ({ appendSubmissionFile: vi.fn(), submitAssignment: vi.fn() }))
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
vi.mock('@/lib/assignments', () => ({ getStudentAssignmentDriveContext: vi.fn() }))
vi.mock('@/lib/api/rate-limit', () => ({ consumeApiRateLimit: vi.fn(), rateLimitResponse: vi.fn() }))

const mockedRequireRole = vi.mocked(requireRole)
const mockedAppendSubmissionFile = vi.mocked(appendSubmissionFile)
const mockedSubmitAssignment = vi.mocked(submitAssignment)
const mockedDeleteDriveFile = vi.mocked(deleteDriveFile)
const mockedEnsureFolders = vi.mocked(ensureDriveFolderStructure)
const mockedUploadDriveFile = vi.mocked(uploadDriveFile)
const mockedDriveContext = vi.mocked(getStudentAssignmentDriveContext)
const mockedConsumeRateLimit = vi.mocked(consumeApiRateLimit)
const mockedRateLimitResponse = vi.mocked(rateLimitResponse)

const routeContext = { params: Promise.resolve({ assignmentId: 'assignment-1' }) }

function multipartRequest(idempotencyKey?: string, file: File = new File(['assignment'], 'answer.txt', { type: 'text/plain' })) {
  const form = new FormData()
  form.set('file', file)
  return new NextRequest('http://localhost/api/assignments/assignment-1/submit', {
    method: 'POST',
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    body: form,
  })
}

function multipartWithInvalidFileEntry() {
  const form = new FormData()
  form.set('file', 'not-a-file')
  return new NextRequest('http://localhost/api/assignments/assignment-1/submit', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'submission-attempt-1' },
    body: form,
  })
}

describe('POST /api/assignments/[assignmentId]/submit', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'student-1' } } as never)
    mockedDriveContext.mockResolvedValue({ classroomId: 'class-1', teacherId: 'teacher-1' } as never)
    mockedEnsureFolders.mockResolvedValue({ student: 'folder-1' } as never)
    mockedConsumeRateLimit.mockResolvedValue({ remaining: 19, resetAt: Date.now() + 60_000 })
    mockedRateLimitResponse.mockReturnValue(null)
    mockedUploadDriveFile.mockResolvedValue({ id: 'drive-file-1', name: 'answer.txt', mimeType: 'text/plain' })
    mockedSubmitAssignment.mockResolvedValue({ id: 'submission-1' } as never)
    mockedAppendSubmissionFile.mockResolvedValue({ id: 'submission-1', files: [{ id: 'drive-file-1' }] } as never)
  })

  it('removes an uploaded Drive file when durable submission creation fails', async () => {
    mockedSubmitAssignment.mockRejectedValue(new DomainRuleError('MAX_ATTEMPTS_REACHED', 'No attempts remaining'))

    const response = await POST(multipartRequest('submission-attempt-1'), routeContext)

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'CONFLICT', message: 'No attempts remaining' } })
    expect(mockedDeleteDriveFile).toHaveBeenCalledWith('teacher-1', 'drive-file-1')
    expect(mockedAppendSubmissionFile).not.toHaveBeenCalled()
  })

  it('does not claim a submission was created when Drive upload fails', async () => {
    mockedUploadDriveFile.mockRejectedValue(new Error('DRIVE_UPLOAD_FAILED'))

    const response = await POST(multipartRequest('submission-attempt-1'), routeContext)

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({ error: { details: { code: 'DRIVE_UPLOAD_FAILED', retryable: true } } })
    expect(mockedSubmitAssignment).not.toHaveBeenCalled()
  })

  it('confirms the teacher Drive upload, persists the submission file, and applies the upload limit', async () => {
    const response = await POST(multipartRequest('submission-attempt-1'), routeContext)
    expect(response.status).toBe(201)
    expect(mockedConsumeRateLimit).toHaveBeenCalledWith({ scope: 'drive-upload', subject: 'student-1', limit: 20, windowMs: 15 * 60 * 1_000 })
    expect(mockedSubmitAssignment).toHaveBeenCalledWith('assignment-1', 'student-1', 'submission-attempt-1')
    expect(mockedAppendSubmissionFile).toHaveBeenCalledWith('submission-1', 'student-1', expect.objectContaining({ id: 'drive-file-1' }))
  })

  it('rejects file submissions without a stable idempotency key', async () => {
    const response = await POST(multipartRequest(), routeContext)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'VALIDATION_ERROR' } })
    expect(mockedDriveContext).not.toHaveBeenCalled()
    expect(mockedUploadDriveFile).not.toHaveBeenCalled()
  })

  it('rejects invalid file metadata before Drive or submission work', async () => {
    const response = await POST(multipartRequest('submission-attempt-1', new File(['unsafe'], 'payload.exe', { type: 'application/x-msdownload' })), routeContext)
    expect(response.status).toBe(400)
    expect(mockedDriveContext).not.toHaveBeenCalled()
    expect(mockedEnsureFolders).not.toHaveBeenCalled()
    expect(mockedUploadDriveFile).not.toHaveBeenCalled()
  })

  it('does not silently turn a malformed multipart file into a fileless submission', async () => {
    const response = await POST(multipartWithInvalidFileEntry(), routeContext)
    expect(response.status).toBe(400)
    expect(mockedSubmitAssignment).not.toHaveBeenCalled()
    expect(mockedUploadDriveFile).not.toHaveBeenCalled()
  })

  it('compensates and reports a retryable state when submission metadata cannot be persisted', async () => {
    mockedAppendSubmissionFile.mockRejectedValue(new Error('FIRESTORE_UNAVAILABLE'))
    const response = await POST(multipartRequest('submission-attempt-1'), routeContext)
    expect(response.status).toBe(503)
    expect(mockedDeleteDriveFile).toHaveBeenCalledWith('teacher-1', 'drive-file-1')
    await expect(response.json()).resolves.toMatchObject({ error: { details: { code: 'DRIVE_METADATA_PERSISTENCE_FAILED', retryable: true } } })
  })

  it('keeps offline file replay retryable until the teacher reconnects Drive', async () => {
    mockedUploadDriveFile.mockRejectedValue(new Error('DRIVE_NOT_CONNECTED'))
    const response = await POST(multipartRequest('submission-attempt-1'), routeContext)
    expect(response.status).toBe(503)
    expect(mockedSubmitAssignment).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({ error: { details: { code: 'DRIVE_NOT_CONNECTED', retryable: true } } })
  })
})
