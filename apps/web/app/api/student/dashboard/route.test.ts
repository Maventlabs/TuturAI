import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { getStudentSubmission } from '@/lib/submissions'
import { listClassroomAssignments } from '@/lib/assignments'
import { listClassroomLeaderboard, listStudentClassrooms } from '@/lib/classrooms'
import { getSessionProfile } from '@/lib/auth'
import { getAdminDb } from '@/lib/firebase/admin'

vi.mock('@/lib/auth', () => ({ getSessionProfile: vi.fn() }))
vi.mock('@/lib/classrooms', () => ({ listClassroomLeaderboard: vi.fn(), listStudentClassrooms: vi.fn() }))
vi.mock('@/lib/assignments', () => ({ listClassroomAssignments: vi.fn() }))
vi.mock('@/lib/submissions', () => ({ getStudentSubmission: vi.fn() }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: vi.fn() }))

const mockedAuth = vi.mocked(getSessionProfile)
const mockedClassrooms = vi.mocked(listStudentClassrooms)
const mockedLeaderboard = vi.mocked(listClassroomLeaderboard)
const mockedAssignments = vi.mocked(listClassroomAssignments)
const mockedSubmission = vi.mocked(getStudentSubmission)
const mockedAdminDb = vi.mocked(getAdminDb)

describe('GET /api/student/dashboard', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockedAdminDb.mockReturnValue({
      collection: vi.fn((name: string) => {
        if (name === 'users') return { doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ data: () => ({ streak: 3 }) }) })) }
        return { where: vi.fn(() => ({ limit: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ docs: [] }) })) })) }
      }),
    } as never)
  })

  it('rejects unauthenticated users', async () => {
    mockedAuth.mockResolvedValue({ user: null, profile: null, isDemo: false })

    const response = await GET()

    expect(response.status).toBe(401)
  })

  it('rejects teacher profiles', async () => {
    mockedAuth.mockResolvedValue({
      user: { uid: 'teacher-1', email: 'teacher@example.com', displayName: 'Teacher' },
      profile: { id: 'teacher-1', role: 'teacher', full_name: 'Teacher', email: 'teacher@example.com', school: null, class: null, nip: null, subject: null, xp: 0, level: 1 },
      isDemo: false,
    })

    const response = await GET()

    expect(response.status).toBe(403)
    expect(mockedClassrooms).not.toHaveBeenCalled()
  })

  it('returns published assignments with the student submission state', async () => {
    mockedAuth.mockResolvedValue({
      user: { uid: 'student-1', email: 'student@example.com', displayName: 'Student' },
      profile: { id: 'student-1', role: 'student', full_name: 'Student', email: 'student@example.com', school: null, class: null, nip: null, subject: null, xp: 40, level: 1 },
      isDemo: false,
    })
    mockedClassrooms.mockResolvedValue([
      { id: 'class-1', teacherId: 'teacher-1', name: 'Speaking XI', description: null, school: null, status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    ])
    mockedLeaderboard.mockResolvedValue([{ rank: 1, studentId: 'student-1', name: 'Student', xp: 40 }])
    mockedAssignments.mockResolvedValue([
      { id: 'assignment-1', classId: 'class-1', title: 'Self introduction', instructions: 'Speak', dueAt: '2026-09-24T00:00:00.000Z', maxAttempts: 2, status: 'published', createdAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-20T00:00:00.000Z' },
    ])
    mockedSubmission.mockResolvedValue({ id: 'submission-1', assignmentId: 'assignment-1', studentId: 'student-1', attempt: 1, status: 'submitted', isLate: false, teacherFeedback: null, submittedAt: '2026-09-22T00:00:00.000Z', updatedAt: '2026-09-22T00:00:00.000Z' })

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        classrooms: [{ id: 'class-1', name: 'Speaking XI' }],
        assignments: [{ id: 'assignment-1', classroomName: 'Speaking XI', submission: { status: 'submitted' } }],
        leaderboard: [{ rank: 1, studentId: 'student-1', xp: 40 }],
        profile: { rank: 1, streak: 3 },
        insights: { totalAttempts: 0, weeklyTarget: { completed: 0, target: 5 }, recentActivity: [] },
      },
    })
  })
})
