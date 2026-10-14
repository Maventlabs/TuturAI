import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'

const { getAdminDb } = vi.hoisted(() => ({ getAdminDb: vi.fn() }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb }))

import { getStudentClassroomVoiceProfile } from './voice-profile'

type StoredDocument = Record<string, unknown>

function inMemoryFirestore(seed: Record<string, Record<string, StoredDocument>>) {
  const collections = new Map(Object.entries(seed).map(([name, documents]) => [name, new Map(Object.entries(documents))]))
  const collectionData = (name: string) => {
    if (!collections.has(name)) collections.set(name, new Map())
    return collections.get(name)!
  }
  const reference = (collection: string, id: string) => ({
    id,
    get: async () => {
      const data = collectionData(collection).get(id)
      return { id, exists: Boolean(data), data: () => data }
    },
  })
  return {
    collections,
    db: { collection: (name: string) => ({ doc: (id: string) => reference(name, id) }) },
  }
}

const readyProfile = {
  teacherId: 'teacher-a',
  provider: 'omnivoice',
  providerVoiceId: 'voice-a',
  status: 'ready',
  consentAt: '2026-01-01T00:00:00.000Z',
  errorCode: null,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
}

/**
 * PRD Fitur 6 acceptance criterion: "voice siswa/guru A tidak pernah digunakan
 * untuk kelas guru B". `getStudentClassroomVoiceProfile` is the only place that
 * resolves which teacher's voice a student hears, so it carries the whole
 * tenant-isolation guarantee. The route tests mock this function out, so a
 * regression here would not be caught by them.
 */
describe('teacher voice tenant isolation', () => {
  beforeEach(() => vi.resetAllMocks())

  function seed(overrides: {
    classrooms?: Record<string, StoredDocument>
    memberships?: Record<string, StoredDocument>
    profiles?: Record<string, StoredDocument>
  } = {}) {
    const fake = inMemoryFirestore({
      classrooms: overrides.classrooms ?? {
        'class-a': { teacherId: 'teacher-a', status: 'active' },
        'class-b': { teacherId: 'teacher-b', status: 'active' },
      },
      classMemberships: overrides.memberships ?? {
        'class-a_student-1': { classId: 'class-a', studentId: 'student-1', status: 'active' },
        'class-b_student-1': { classId: 'class-b', studentId: 'student-1', status: 'active' },
      },
      voiceProfiles: overrides.profiles ?? {
        'teacher-a': readyProfile,
        'teacher-b': { ...readyProfile, teacherId: 'teacher-b', providerVoiceId: 'voice-b' },
      },
    })
    getAdminDb.mockReturnValue(fake.db as never)
    return fake
  }

  it('resolves each classroom to its own teacher voice', async () => {
    seed()
    await expect(getStudentClassroomVoiceProfile('student-1', 'class-a')).resolves.toMatchObject({ providerVoiceId: 'voice-a' })
    await expect(getStudentClassroomVoiceProfile('student-1', 'class-b')).resolves.toMatchObject({ providerVoiceId: 'voice-b' })
  })

  it('refuses a student who is not an active member of the classroom', async () => {
    seed()
    await expect(getStudentClassroomVoiceProfile('student-2', 'class-a')).rejects.toThrow('CLASSROOM_NOT_FOUND')
  })

  it('refuses a membership that was revoked', async () => {
    seed({
      memberships: { 'class-a_student-1': { classId: 'class-a', studentId: 'student-1', status: 'removed' } },
    })
    await expect(getStudentClassroomVoiceProfile('student-1', 'class-a')).rejects.toThrow('CLASSROOM_NOT_FOUND')
  })

  it('refuses an archived classroom', async () => {
    seed({
      classrooms: { 'class-a': { teacherId: 'teacher-a', status: 'archived' } },
    })
    await expect(getStudentClassroomVoiceProfile('student-1', 'class-a')).rejects.toThrow('CLASSROOM_NOT_FOUND')
  })

  it('refuses an unknown classroom instead of falling back to another teacher', async () => {
    seed()
    await expect(getStudentClassroomVoiceProfile('student-1', 'class-missing')).rejects.toThrow('CLASSROOM_NOT_FOUND')
  })

  it('never returns another teacher voice when the classroom teacher has no profile', async () => {
    seed({ profiles: { 'teacher-b': { ...readyProfile, teacherId: 'teacher-b', providerVoiceId: 'voice-b' } } })
    // teacher-a has no profile at all; the student must get null rather than
    // teacher-b's voice leaking in.
    await expect(getStudentClassroomVoiceProfile('student-1', 'class-a')).resolves.toBeNull()
  })

  it('ignores a membership document that names a different student', async () => {
    seed({
      memberships: { 'class-a_student-1': { classId: 'class-a', studentId: 'someone-else', status: 'active' } },
    })
    await expect(getStudentClassroomVoiceProfile('student-1', 'class-a')).rejects.toThrow('CLASSROOM_NOT_FOUND')
  })
})