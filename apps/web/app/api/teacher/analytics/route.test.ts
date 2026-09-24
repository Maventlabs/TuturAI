import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { GET } from './route'
import { requireRole } from '@/lib/api/auth-guard'
import { getAdminDb } from '@/lib/firebase/admin'
import { listTeacherClassrooms, listTeacherClassroomMembers } from '@/lib/classrooms'

vi.mock('@/lib/api/auth-guard', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: vi.fn() }))
vi.mock('@/lib/classrooms', () => ({ listTeacherClassrooms: vi.fn(), listTeacherClassroomMembers: vi.fn() }))

const mockedRequireRole = vi.mocked(requireRole)
const mockedGetAdminDb = vi.mocked(getAdminDb)
const mockedListClassrooms = vi.mocked(listTeacherClassrooms)
const mockedListMembers = vi.mocked(listTeacherClassroomMembers)

describe('GET /api/teacher/analytics', () => {
  beforeEach(() => vi.resetAllMocks())

  it('rejects non-teacher sessions before reading analytics data', async () => {
    mockedRequireRole.mockResolvedValue({ ok: false, response: new NextResponse('Forbidden', { status: 403 }) })

    const response = await GET(new Request('http://localhost/api/teacher/analytics'))

    expect(response.status).toBe(403)
    expect(mockedListClassrooms).not.toHaveBeenCalled()
  })

  it('returns aggregates scoped to the teacher classrooms', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'teacher-1' } } as never)
    mockedListClassrooms.mockResolvedValue([{ id: 'class-1', name: 'XI IPA' }] as never)
    mockedListMembers.mockResolvedValue([{ studentId: 'student-1', name: 'Siswa', email: null, joinedAt: '' }])
    mockedGetAdminDb.mockReturnValue({
      collection: (name: string) => ({
        where: () => ({ limit: () => ({ get: async () => ({ docs: name === 'questionAttempts' ? [{ data: () => ({ studentId: 'student-1', questionId: 'q-1', isCorrect: true, createdAt: '2026-09-01T00:00:00.000Z' }) }] : [{ data: () => ({ studentId: 'student-1', overall: 84, createdAt: '2026-09-01T00:00:00.000Z' }) }] }) }) }),
        doc: () => ({}),
      }),
      getAll: async () => [{ id: 'q-1', data: () => ({ skill: 'grammar' }) }],
    } as never)

    const response = await GET(new Request('http://localhost/api/teacher/analytics'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ data: { summary: { classroomCount: 1, studentCount: 1, practiceAccuracy: 100, averageSpeakingScore: 84 }, skills: [{ skill: 'grammar', score: 100 }] } })
  })
})
