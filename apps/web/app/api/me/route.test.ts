import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, PATCH } from './route'
import { getSessionProfile } from '@/lib/auth'
import { getAdminDb } from '@/lib/firebase/admin'

vi.mock('@/lib/auth', () => ({ getSessionProfile: vi.fn() }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: vi.fn() }))

const mockedAuth = vi.mocked(getSessionProfile)
const mockedAdminDb = vi.mocked(getAdminDb)

function profile(role: 'student' | 'teacher' = 'student') {
  return {
    id: 'student-1',
    role,
    full_name: 'Budi Lama',
    email: 'budi@example.com',
    school: 'SMA Lama',
    class: 'XI IPA 2',
    nip: null,
    subject: null,
    xp: 40,
    level: 1,
    streak: 3,
  }
}

describe('/api/me', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('rejects an unauthenticated profile update', async () => {
    mockedAuth.mockResolvedValue({ user: null, profile: null, isDemo: false })

    const response = await PATCH(new Request('http://localhost/api/me', {
      method: 'PATCH',
      body: JSON.stringify({ displayName: 'Budi Baru', school: 'SMA Baru' }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(response.status).toBe(401)
  })

  it('updates only the authenticated profile and returns the persisted fields', async () => {
    mockedAuth.mockResolvedValue({
      user: { uid: 'student-1', email: 'budi@example.com', displayName: 'Budi Lama' },
      profile: profile(),
      isDemo: false,
    })
    const update = vi.fn().mockResolvedValue(undefined)
    const get = vi.fn().mockResolvedValue({ data: () => ({ displayName: 'Budi Baru', school: 'SMA Baru' }) })
    mockedAdminDb.mockReturnValue({
      collection: vi.fn(() => ({ doc: vi.fn(() => ({ update, get })) })),
    } as never)

    const response = await PATCH(new Request('http://localhost/api/me', {
      method: 'PATCH',
      body: JSON.stringify({ displayName: ' Budi Baru ', school: ' SMA Baru ', role: 'teacher', xp: 9999 }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(response.status).toBe(400)
    expect(update).not.toHaveBeenCalled()

    const validResponse = await PATCH(new Request('http://localhost/api/me', {
      method: 'PATCH',
      body: JSON.stringify({ displayName: ' Budi Baru ', school: ' SMA Baru ' }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(validResponse.status).toBe(200)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Budi Baru', school: 'SMA Baru' }))
    await expect(validResponse.json()).resolves.toMatchObject({ data: { profile: { id: 'student-1', full_name: 'Budi Baru', school: 'SMA Baru' } } })
  })

  it('keeps GET profile capabilities intact', async () => {
    mockedAuth.mockResolvedValue({
      user: { uid: 'student-1', email: 'budi@example.com', displayName: 'Budi Lama' },
      profile: profile(),
      isDemo: false,
    })

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ data: { profile: { role: 'student' }, permissions: expect.arrayContaining(['classrooms:join']) } })
  })
})
