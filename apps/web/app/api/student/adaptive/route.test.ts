import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { GET } from './route'
import { requireRole } from '@/lib/api/auth-guard'
import { getAdminDb } from '@/lib/firebase/admin'
import { listPublishedQuestions } from '@/lib/question-bank'

vi.mock('@/lib/api/auth-guard', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: vi.fn() }))
vi.mock('@/lib/question-bank', () => ({ listPublishedQuestions: vi.fn() }))

const mockedRequireRole = vi.mocked(requireRole)
const mockedGetAdminDb = vi.mocked(getAdminDb)
const mockedListQuestions = vi.mocked(listPublishedQuestions)

describe('GET /api/student/adaptive', () => {
  beforeEach(() => vi.resetAllMocks())

  it('rejects unauthenticated requests', async () => {
    mockedRequireRole.mockResolvedValue({ ok: false, response: new NextResponse('Unauthorized', { status: 401 }) })

    const response = await GET()

    expect(response.status).toBe(401)
    expect(mockedListQuestions).not.toHaveBeenCalled()
  })

  it('returns a durable recommendation from published content and attempts', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'student-1' } } as never)
    mockedListQuestions.mockResolvedValue([
      { id: 'q-1', contentType: 'vocabulary', skill: 'vocabulary', level: 'beginner', prompt: 'Learn rapid', options: [], explanation: '', tags: ['Vocabulary'], word: 'rapid' },
      { id: 'q-2', contentType: 'question', skill: 'grammar', level: 'beginner', prompt: 'Choose the tense', options: [], explanation: '', tags: ['Grammar'] },
    ])
    mockedGetAdminDb.mockReturnValue({
      collection: () => ({
        where: () => ({ limit: () => ({ get: async () => ({ docs: [{ data: () => ({ questionId: 'q-2', isCorrect: true }) }] }) }) }),
      }),
    } as never)

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        recommendation: { id: 'q-1', status: 'recommended', score: null },
        activities: [{ id: 'q-1' }, { id: 'q-2', status: 'completed', score: 100 }],
      },
    })
  })
})
