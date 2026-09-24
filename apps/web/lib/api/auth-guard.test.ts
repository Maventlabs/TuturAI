import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireAuth, requireRole } from './auth-guard'
import { getSessionProfile } from '@/lib/auth'

vi.mock('@/lib/auth', () => ({
  getSessionProfile: vi.fn(),
}))

const mockedGetSessionProfile = vi.mocked(getSessionProfile)

describe('API auth guards', () => {
  beforeEach(() => {
    mockedGetSessionProfile.mockReset()
  })

  it('rejects requests without both a verified user and a profile', async () => {
    mockedGetSessionProfile.mockResolvedValue({ user: null, profile: null, isDemo: false })

    const result = await requireAuth()

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.response.status).toBe(401)
    await expect(result.response.json()).resolves.toMatchObject({ error: { code: 'UNAUTHENTICATED' } })
  })

  it('rejects an authenticated user with the wrong role', async () => {
    mockedGetSessionProfile.mockResolvedValue({
      user: { uid: 'student-1', email: 'student@example.com', displayName: 'Student' },
      profile: {
        id: 'student-1',
        role: 'student',
        full_name: 'Student',
        email: 'student@example.com',
        school: 'SMA 1',
        class: 'XI IPA 2',
        nip: null,
        subject: null,
        xp: 0,
        level: 1,
      },
      isDemo: false,
    })

    const result = await requireRole('teacher')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.response.status).toBe(403)
    await expect(result.response.json()).resolves.toMatchObject({ error: { code: 'FORBIDDEN' } })
  })

  it('returns the verified identity for an authorized role', async () => {
    const user = { uid: 'teacher-1', email: 'teacher@example.com', displayName: 'Teacher' }
    const profile = {
      id: 'teacher-1' as const,
      role: 'teacher' as const,
      full_name: 'Teacher',
      email: 'teacher@example.com',
      school: 'SMA 1',
      class: null,
      nip: '19800101',
      subject: 'English',
      xp: 0,
      level: 1,
    }
    mockedGetSessionProfile.mockResolvedValue({ user, profile, isDemo: false })

    const result = await requireRole('teacher')

    expect(result).toEqual({ ok: true, user, profile })
  })
})
