import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { requireRole, listTeacherClassrooms, listTeacherClassroomMembers } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  listTeacherClassrooms: vi.fn(),
  listTeacherClassroomMembers: vi.fn(),
}))

vi.mock('@/lib/api/auth-guard', () => ({ requireRole }))
vi.mock('@/lib/classrooms', () => ({ listTeacherClassrooms, listTeacherClassroomMembers }))

import { GET } from './route'

describe('GET /api/teacher/students/[studentId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireRole.mockResolvedValue({ ok: true, user: { uid: 'teacher-123' } })
    listTeacherClassrooms.mockResolvedValue([
      { id: 'class-owned', name: 'English E2E', status: 'active' },
      { id: 'class-second', name: 'English B', status: 'active' },
    ])
    listTeacherClassroomMembers.mockImplementation(async (classId) => classId === 'class-owned'
      ? [{ studentId: 'student-123', name: 'E2E Student', email: 'student@example.test', level: 2, streak: 4, speakingScore: 81, joinedAt: '2026-01-01T00:00:00.000Z' }]
      : [])
  })

  it('returns the profile and only the requesting teacher owned classrooms', async () => {
    const response = await GET(new Request('https://example.test/api/teacher/students/student-123'), {
      params: Promise.resolve({ studentId: 'student-123' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.student).toMatchObject({ id: 'student-123', name: 'E2E Student', level: 2, streak: 4 })
    expect(body.data.classrooms).toEqual([{ id: 'class-owned', name: 'English E2E', joinedAt: '2026-01-01T00:00:00.000Z' }])
    expect(listTeacherClassroomMembers).toHaveBeenCalledTimes(2)
  })

  it('fails closed for a student outside the teacher classes', async () => {
    listTeacherClassroomMembers.mockResolvedValue([])
    const response = await GET(new Request('https://example.test/api/teacher/students/outsider-1'), {
      params: Promise.resolve({ studentId: 'outsider-1' }),
    })

    expect(response.status).toBe(404)
  })

  it('rejects malformed student IDs before querying classroom members', async () => {
    const response = await GET(new Request('https://example.test/api/teacher/students/%2F'), {
      params: Promise.resolve({ studentId: '/' }),
    })

    expect(response.status).toBe(400)
    expect(listTeacherClassroomMembers).not.toHaveBeenCalled()
  })

  it('preserves the shared unauthorized response', async () => {
    const unauthorized = NextResponse.json({ error: { code: 'UNAUTHENTICATED' } }, { status: 401 })
    requireRole.mockResolvedValue({ ok: false, response: unauthorized })
    const response = await GET(new Request('https://example.test/api/teacher/students/student-123'), {
      params: Promise.resolve({ studentId: 'student-123' }),
    })

    expect(response.status).toBe(401)
    expect(listTeacherClassrooms).not.toHaveBeenCalled()
  })
})
