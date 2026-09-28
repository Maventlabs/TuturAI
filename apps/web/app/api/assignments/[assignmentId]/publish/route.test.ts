import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { AssignmentRuleError } from '@tuturai/domain'
import { POST } from './route'
import { requireRole } from '@/lib/api/auth-guard'
import { publishTeacherAssignment } from '@/lib/assignments'

vi.mock('@/lib/api/auth-guard', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/assignments', () => ({ publishTeacherAssignment: vi.fn() }))

const mockedRequireRole = vi.mocked(requireRole)
const mockedPublish = vi.mocked(publishTeacherAssignment)
const context = { params: Promise.resolve({ assignmentId: 'assignment-1' }) }

describe('POST /api/assignments/[assignmentId]/publish', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'teacher-1' } } as never)
    mockedPublish.mockResolvedValue({ id: 'assignment-1', status: 'published' } as never)
  })

  it('publishes through the teacher-owned server boundary and returns the persisted assignment', async () => {
    const response = await POST(new NextRequest('https://tuturai-apps.netlify.app/api/assignments/assignment-1/publish', { method: 'POST' }), context)
    expect(response.status).toBe(200)
    expect(mockedPublish).toHaveBeenCalledWith('assignment-1', 'teacher-1')
    await expect(response.json()).resolves.toMatchObject({ data: { id: 'assignment-1', status: 'published' } })
  })

  it('returns 409 for an invalid transition from a non-draft assignment', async () => {
    mockedPublish.mockRejectedValue(new AssignmentRuleError('INVALID_TRANSITION', 'Already published'))
    const response = await POST(new NextRequest('https://tuturai-apps.netlify.app/api/assignments/assignment-1/publish', { method: 'POST' }), context)
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'CONFLICT' } })
  })

  it('returns 404 when the teacher does not own the assignment classroom', async () => {
    mockedPublish.mockRejectedValue(new Error('ASSIGNMENT_NOT_FOUND'))
    const response = await POST(new NextRequest('https://tuturai-apps.netlify.app/api/assignments/assignment-1/publish', { method: 'POST' }), context)
    expect(response.status).toBe(404)
  })
})
