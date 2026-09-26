import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { GET, PATCH } from './route'
import { requireRole } from '@/lib/api/auth-guard'
import { getAdminDb } from '@/lib/firebase/admin'

vi.mock('@/lib/api/auth-guard', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: vi.fn() }))

const mockedAuth = vi.mocked(requireRole)
const mockedAdminDb = vi.mocked(getAdminDb)
const teacher = { id: 'teacher-1', role: 'teacher' as const, full_name: 'Ava', email: 'ava@example.com', school: 'SMA', class: null, nip: null, subject: 'English', xp: 0, level: 1, streak: 0 }

describe('/api/teacher/preferences', () => {
  beforeEach(() => vi.resetAllMocks())

  it('rejects a student or unauthenticated request', async () => {
    mockedAuth.mockResolvedValue({ ok: false, response: new NextResponse(null, { status: 403 }) })
    expect((await GET()).status).toBe(403)
    expect((await PATCH(new Request('http://localhost', { method: 'PATCH', body: '{}' }))).status).toBe(403)
  })

  it('reads defaults when no preferences were saved', async () => {
    mockedAuth.mockResolvedValue({ ok: true, user: { uid: 'teacher-1', email: 'ava@example.com', displayName: 'Ava' }, profile: teacher })
    mockedAdminDb.mockReturnValue({ collection: vi.fn(() => ({ doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ data: () => ({}) }) })) })) } as never)
    expect(await (await GET()).json()).toEqual({ data: { submissions: true, lowScore: true, weekly: false, device: true } })
  })

  it('persists validated preferences for the authenticated teacher', async () => {
    mockedAuth.mockResolvedValue({ ok: true, user: { uid: 'teacher-1', email: 'ava@example.com', displayName: 'Ava' }, profile: teacher })
    const update = vi.fn().mockResolvedValue(undefined)
    const get = vi.fn().mockResolvedValue({ data: () => ({ teacherPreferences: { submissions: false, lowScore: true, weekly: true, device: false } }) })
    mockedAdminDb.mockReturnValue({ collection: vi.fn(() => ({ doc: vi.fn(() => ({ update, get })) })) } as never)

    const response = await PATCH(new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ submissions: false, lowScore: true, weekly: true, device: false, role: 'student' }),
      headers: { 'content-type': 'application/json' },
    }))
    expect(response.status).toBe(400)
    expect(update).not.toHaveBeenCalled()

    const valid = await PATCH(new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ submissions: false, lowScore: true, weekly: true, device: false }),
      headers: { 'content-type': 'application/json' },
    }))
    expect(valid.status).toBe(200)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ teacherPreferences: { submissions: false, lowScore: true, weekly: true, device: false } }))
    await expect(valid.json()).resolves.toEqual({ data: { submissions: false, lowScore: true, weekly: true, device: false } })
  })
})
