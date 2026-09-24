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

describe('GET /api/teacher/reports', () => {
  beforeEach(() => vi.resetAllMocks())

  it('rejects non-teacher sessions before reading report data', async () => {
    mockedRequireRole.mockResolvedValue({ ok: false, response: new NextResponse('Forbidden', { status: 403 }) })

    const response = await GET(new Request('http://localhost/api/teacher/reports'))

    expect(response.status).toBe(403)
    expect(mockedListClassrooms).not.toHaveBeenCalled()
  })

  it('returns a PDF only for a teacher-owned classroom', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'teacher-1' } } as never)
    mockedListClassrooms.mockResolvedValue([{ id: 'class-1', name: 'XI IPA' }] as never)
    mockedListMembers.mockResolvedValue([{ studentId: 'student-1', name: 'Siswa', email: null, joinedAt: '' }])
    mockedGetAdminDb.mockReturnValue({
      collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }) }),
    } as never)

    const response = await GET(new Request('http://localhost/api/teacher/reports?classroomId=class-1'))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('content-disposition')).toContain('tuturai-report-class-1.pdf')
    expect(Buffer.from(await response.arrayBuffer()).toString('ascii')).toContain('%PDF-1.4')
  })
})
