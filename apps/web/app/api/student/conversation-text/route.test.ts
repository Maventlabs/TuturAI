import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { POST } from './route'
import { requireRole } from '@/lib/api/auth-guard'
import { getAdminDb } from '@/lib/firebase/admin'

vi.mock('@/lib/api/auth-guard', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: vi.fn() }))

const mockedRequireRole = vi.mocked(requireRole)
const mockedGetAdminDb = vi.mocked(getAdminDb)

describe('POST /api/student/conversation-text', () => {
  beforeEach(() => vi.resetAllMocks())

  it('rejects unauthenticated requests', async () => {
    mockedRequireRole.mockResolvedValue({ ok: false, response: new NextResponse('Unauthorized', { status: 401 }) })
    const response = await POST(new NextRequest('http://localhost/api/student/conversation-text', { method: 'POST', body: '{}' }))
    expect(response.status).toBe(401)
  })

  it('scores and persists a validated text answer', async () => {
    mockedRequireRole.mockResolvedValue({ ok: true, user: { uid: 'student-1' } } as never)
    const create = vi.fn()
    mockedGetAdminDb.mockReturnValue({
      collection: (name: string) => {
        if (name === 'questionBank') return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ status: 'published', contentType: 'conversation', prompt: 'Discuss technology and learning' }) }) }) }
        return { doc: () => ({ get: async () => ({ exists: false }), create }) }
      },
    } as never)
    const response = await POST(new NextRequest('http://localhost/api/student/conversation-text', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: 'conversation-1', attemptId: 'attempt-1', answer: 'I use technology for school and learning every day.' }),
    }))
    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ data: { score: 75, metadata: { rubric: 'keyword-relevance-v1' } } })
    expect(create).toHaveBeenCalledOnce()
  })
})
