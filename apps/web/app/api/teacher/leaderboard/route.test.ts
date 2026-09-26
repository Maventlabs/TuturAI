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

describe('GET /api/teacher/leaderboard', () => {
  beforeEach(() => vi.resetAllMocks())

  it('rejects non-teacher sessions', async () => {
    mockedRequireRole.mockResolvedValue({ ok: false, response: new NextResponse('Forbidden', { status: 403 }) })

    const response = await GET()

    expect(response.status).toBe(403)
    expect(mockedListClassrooms).not.toHaveBeenCalled()
  })

  it('returns XP-ranked students with persisted speaking scores when available', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'teacher-1' } } as never)
    mockedListClassrooms.mockResolvedValue([{ id: 'class-1', name: 'XI IPA' }] as never)
    mockedListMembers.mockResolvedValue([{ studentId: 'student-1', name: 'Ani', email: null, joinedAt: '', level: 1, streak: 0, speakingScore: 84 }])
    mockedGetAdminDb.mockReturnValue({
      collection: (name: string) => ({
        doc: () => ({}),
        where: () => ({ limit: () => ({ get: async () => ({ docs: name === 'assessments' ? [{ data: () => ({ studentId: 'student-1', overall: 76 }) }] : [] }) }) }),
      }),
      getAll: async () => [{ id: 'student-1', data: () => ({ xp: 80 }) }],
    } as never)

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ data: [{ rank: 1, studentId: 'student-1', xp: 80, speakingScore: 76, className: 'XI IPA' }] })
  })
})
