import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { POST } from './route'
import { requireRole } from '@/lib/api/auth-guard'
import { gradeSubmission } from '@/lib/submissions'

vi.mock('@/lib/api/auth-guard', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/submissions', () => ({ gradeSubmission: vi.fn() }))

const mockedRequireRole = vi.mocked(requireRole)
const mockedGradeSubmission = vi.mocked(gradeSubmission)

function context(submissionId = 'submission-1') {
  return { params: Promise.resolve({ submissionId }) }
}

function request(body: unknown) {
  return new Request('http://localhost/api/submissions/submission-1/grade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/submissions/[submissionId]/grade', () => {
  beforeEach(() => vi.resetAllMocks())

  it('rejects unauthenticated requests', async () => {
    mockedRequireRole.mockResolvedValue({ ok: false, response: new NextResponse('Unauthorized', { status: 401 }) })

    const response = await POST(request({ score: 80 }), context())

    expect(response.status).toBe(401)
    expect(mockedGradeSubmission).not.toHaveBeenCalled()
  })

  it.each([0, 101, 88.5, 'abc'])('rejects an out-of-range score (%s)', async (score) => {
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'teacher-1' } } as never)

    const response = await POST(request({ score }), context())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'VALIDATION_ERROR' } })
    expect(mockedGradeSubmission).not.toHaveBeenCalled()
  })

  it('rejects a score the service refuses', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'teacher-1' } } as never)
    mockedGradeSubmission.mockRejectedValue(new Error('INVALID_SCORE'))

    const response = await POST(request({ score: 100 }), context())

    expect(response.status).toBe(400)
  })

  it('returns not found when the teacher does not own the submission', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'teacher-1' } } as never)
    mockedGradeSubmission.mockRejectedValue(new Error('SUBMISSION_NOT_FOUND'))

    const response = await POST(request({ score: 80 }), context())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'NOT_FOUND' } })
  })

  it('saves the score together with the feedback', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'teacher-1' } } as never)
    mockedGradeSubmission.mockResolvedValue({ id: 'submission-1', teacherScore: 88 } as never)

    const response = await POST(request({ score: 88, feedback: '  Bagus, perbaiki intonasi.  ' }), context())

    expect(response.status).toBe(200)
    expect(mockedGradeSubmission).toHaveBeenCalledWith(
      'submission-1',
      'teacher-1',
      88,
      'Bagus, perbaiki intonasi.',
    )
    await expect(response.json()).resolves.toMatchObject({ data: { teacherScore: 88 } })
  })

  it('clears the grade when the score is empty', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'teacher-1' } } as never)
    mockedGradeSubmission.mockResolvedValue({ id: 'submission-1', teacherScore: null } as never)

    const response = await POST(request({ score: '' }), context())

    expect(response.status).toBe(200)
    expect(mockedGradeSubmission).toHaveBeenCalledWith('submission-1', 'teacher-1', null, undefined)
  })
})
