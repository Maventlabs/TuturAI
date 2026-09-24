import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { getSessionProfile } from '@/lib/auth'

vi.mock('@/lib/auth', () => ({
  getSessionProfile: vi.fn(),
}))

const mockedGetSessionProfile = vi.mocked(getSessionProfile)

const studentProfile = {
  id: 'student-1' as const,
  role: 'student' as const,
  full_name: 'Student One',
  email: 'student@example.com',
  school: 'SMA 1',
  class: 'XI IPA 2',
  nip: null,
  subject: null,
  xp: 120,
  level: 2,
}

describe('GET /api/me', () => {
  beforeEach(() => mockedGetSessionProfile.mockReset())

  it('returns 401 when there is no verified session profile', async () => {
    mockedGetSessionProfile.mockResolvedValue({ user: null, profile: null, isDemo: false })

    const response = await GET()

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'UNAUTHENTICATED' } })
  })

  it('returns the verified profile and role capabilities', async () => {
    mockedGetSessionProfile.mockResolvedValue({
      user: { uid: 'student-1', email: studentProfile.email, displayName: studentProfile.full_name },
      profile: studentProfile,
      isDemo: false,
    })

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: {
        user: { uid: 'student-1', email: 'student@example.com', displayName: 'Student One' },
        profile: studentProfile,
        permissions: ['classrooms:join', 'assignments:submit', 'speaking:practice', 'progress:read'],
      },
    })
  })

  it('does not expose a profile when the stored role is invalid', async () => {
    mockedGetSessionProfile.mockResolvedValue({
      user: { uid: 'broken-1', email: 'broken@example.com', displayName: 'Broken' },
      profile: null,
      isDemo: false,
    })

    const response = await GET()

    expect(response.status).toBe(401)
  })
})
