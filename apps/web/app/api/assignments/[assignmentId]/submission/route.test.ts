import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { GET } from './route'
import { requireRole } from '@/lib/api/auth-guard'
import { getStudentSubmission } from '@/lib/submissions'

vi.mock('@/lib/api/auth-guard', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/submissions', () => ({ getStudentSubmission: vi.fn() }))

const mockedRequireRole = vi.mocked(requireRole)
const mockedGetStudentSubmission = vi.mocked(getStudentSubmission)

function context(assignmentId = 'assignment-1') {
  return { params: Promise.resolve({ assignmentId }) }
}

describe('GET /api/assignments/[assignmentId]/submission', () => {
  beforeEach(() => vi.resetAllMocks())

  it('rejects unauthenticated requests', async () => {
    mockedRequireRole.mockResolvedValue({ ok: false, response: new NextResponse('Unauthorized', { status: 401 }) })

    const response = await GET(new Request('http://localhost'), context())

    expect(response.status).toBe(401)
    expect(mockedGetStudentSubmission).not.toHaveBeenCalled()
  })

  it('returns not found when the assignment is not published', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'student-1' } } as never)
    mockedGetStudentSubmission.mockRejectedValue(new Error('ASSIGNMENT_NOT_FOUND'))

    const response = await GET(new Request('http://localhost'), context('draft-assignment'))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'NOT_FOUND' } })
  })

  it('rejects students who are not active members of the assignment classroom', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'outsider-1' } } as never)
    mockedGetStudentSubmission.mockRejectedValue(new Error('CLASSROOM_NOT_FOUND'))

    const response = await GET(new Request('http://localhost'), context())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'FORBIDDEN' } })
  })

  it('returns the submission only after the scoped lookup succeeds', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'student-1' } } as never)
    mockedGetStudentSubmission.mockResolvedValue({
      id: 'submission-1',
      assignmentId: 'assignment-1',
      studentId: 'student-1',
      attempt: 1,
      status: 'submitted',
      isLate: false,
      teacherFeedback: null,
      submittedAt: '2026-09-24T00:00:00.000Z',
      updatedAt: '2026-09-24T00:00:00.000Z',
      files: [],
    })

    const response = await GET(new Request('http://localhost'), context())

    expect(response.status).toBe(200)
    expect(mockedGetStudentSubmission).toHaveBeenCalledWith('assignment-1', 'student-1')
    await expect(response.json()).resolves.toMatchObject({ data: { id: 'submission-1' } })
  })
})
