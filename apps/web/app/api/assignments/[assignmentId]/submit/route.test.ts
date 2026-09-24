import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'
import { requireRole } from '@/lib/api/auth-guard'
import { appendSubmissionFile, submitAssignment } from '@/lib/submissions'
import { deleteDriveFile, ensureDriveFolderStructure, uploadDriveFile } from '@/lib/drive'
import { getStudentAssignmentDriveContext } from '@/lib/assignments'

vi.mock('@/lib/api/auth-guard', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/submissions', () => ({ appendSubmissionFile: vi.fn(), submitAssignment: vi.fn() }))
vi.mock('@/lib/drive', () => ({
  DriveConfigurationError: class DriveConfigurationError extends Error {},
  deleteDriveFile: vi.fn(),
  ensureDriveFolderStructure: vi.fn(),
  uploadDriveFile: vi.fn(),
}))
vi.mock('@/lib/assignments', () => ({ getStudentAssignmentDriveContext: vi.fn() }))

const mockedRequireRole = vi.mocked(requireRole)
const mockedAppendSubmissionFile = vi.mocked(appendSubmissionFile)
const mockedSubmitAssignment = vi.mocked(submitAssignment)
const mockedDeleteDriveFile = vi.mocked(deleteDriveFile)
const mockedEnsureFolders = vi.mocked(ensureDriveFolderStructure)
const mockedUploadDriveFile = vi.mocked(uploadDriveFile)
const mockedDriveContext = vi.mocked(getStudentAssignmentDriveContext)

const routeContext = { params: Promise.resolve({ assignmentId: 'assignment-1' }) }

function multipartRequest() {
  const form = new FormData()
  form.set('file', new File(['assignment'], 'answer.txt', { type: 'text/plain' }))
  return new NextRequest('http://localhost/api/assignments/assignment-1/submit', { method: 'POST', body: form })
}

describe('POST /api/assignments/[assignmentId]/submit', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'student-1' } } as never)
    mockedDriveContext.mockResolvedValue({ classroomId: 'class-1', teacherId: 'teacher-1' } as never)
    mockedEnsureFolders.mockResolvedValue({ student: 'folder-1' } as never)
    mockedUploadDriveFile.mockResolvedValue({ id: 'drive-file-1', name: 'answer.txt', mimeType: 'text/plain' })
    mockedSubmitAssignment.mockResolvedValue({ id: 'submission-1' } as never)
    mockedAppendSubmissionFile.mockResolvedValue({ id: 'submission-1', files: [{ id: 'drive-file-1' }] } as never)
  })

  it('removes an uploaded Drive file when durable submission creation fails', async () => {
    mockedSubmitAssignment.mockRejectedValue(new Error('MAX_ATTEMPTS_REACHED'))

    const response = await POST(multipartRequest(), routeContext)

    expect(response.status).toBe(409)
    expect(mockedDeleteDriveFile).toHaveBeenCalledWith('teacher-1', 'drive-file-1')
    expect(mockedAppendSubmissionFile).not.toHaveBeenCalled()
  })

  it('does not claim a submission was created when Drive upload fails', async () => {
    mockedUploadDriveFile.mockRejectedValue(new Error('DRIVE_UPLOAD_FAILED'))

    const response = await POST(multipartRequest(), routeContext)

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({ error: { message: 'File belum tersimpan; submission belum dikonfirmasi' } })
    expect(mockedSubmitAssignment).not.toHaveBeenCalled()
  })
})
