import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'

const { getAdminDb } = vi.hoisted(() => ({ getAdminDb: vi.fn() }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb }))

import { appendAssignmentAttachment, publishTeacherAssignment } from './assignments'
import { appendSubmissionFile } from './submissions'

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
    create: async (data: StoredDocument) => { collectionData(collection).set(id, data) },
    set: async (data: StoredDocument) => { collectionData(collection).set(id, data) },
    update: async (data: StoredDocument) => {
      const current = collectionData(collection).get(id)
      if (!current) throw new Error('NOT_FOUND')
      collectionData(collection).set(id, { ...current, ...data })
    },
  })
  const db = {
    collection: (name: string) => ({ doc: (id: string) => reference(name, id) }),
    runTransaction: async (callback: (transaction: Record<string, (...args: never[]) => Promise<unknown> | void>) => Promise<unknown>) => callback({
      get: async (ref: ReturnType<typeof reference>) => ref.get(),
      create: async (ref: ReturnType<typeof reference>, data: StoredDocument) => ref.create(data),
      set: async (ref: ReturnType<typeof reference>, data: StoredDocument) => ref.set(data),
      update: async (ref: ReturnType<typeof reference>, data: StoredDocument) => ref.update(data),
    } as never),
  }
  return { db, collections }
}

const teacherId = 'teacher-1'
const studentId = 'student-1'
const file = { id: 'drive-file-1', name: 'answer.txt', mimeType: 'text/plain', size: '8', webViewLink: 'https://drive.google.com/file/1' }

describe('Drive metadata persistence', () => {
  let fake: ReturnType<typeof inMemoryFirestore>

  beforeEach(() => {
    vi.resetAllMocks()
    const now = Timestamp.now()
    fake = inMemoryFirestore({
      assignments: { 'assignment-1': { classId: 'class-1', title: 'Writing', status: 'published', attachments: [], createdAt: now, updatedAt: now } },
      classrooms: { 'class-1': { teacherId, status: 'active', name: 'Class 1' } },
      submissions: { 'assignment-1_student-1': { id: 'assignment-1_student-1', assignmentId: 'assignment-1', studentId, status: 'submitted', attempt: 1, files: [], updatedAt: now } },
    })
    getAdminDb.mockReturnValue(fake.db as never)
  })

  it('persists an assignment attachment once and returns Firestore read-back on retry', async () => {
    const first = await appendAssignmentAttachment('assignment-1', teacherId, file)
    const retry = await appendAssignmentAttachment('assignment-1', teacherId, file)
    const stored = fake.collections.get('assignments')!.get('assignment-1')!

    expect(first.attachments).toEqual([file])
    expect(retry.attachments).toEqual([file])
    expect(stored.attachments).toEqual([file])
  })

  it('rejects a teacher who does not own the assignment classroom', async () => {
    await expect(appendAssignmentAttachment('assignment-1', 'teacher-outsider', file)).rejects.toThrow('ASSIGNMENT_NOT_FOUND')
    expect(fake.collections.get('assignments')!.get('assignment-1')!.attachments).toEqual([])
  })

  it('publishes a draft only for the owning teacher and returns the saved document', async () => {
    const assignment = fake.collections.get('assignments')!.get('assignment-1')!
    fake.collections.get('assignments')!.set('assignment-1', { ...assignment, status: 'draft' })

    const published = await publishTeacherAssignment('assignment-1', teacherId)
    expect(published.status).toBe('published')
    expect(fake.collections.get('assignments')!.get('assignment-1')!.status).toBe('published')
    await expect(publishTeacherAssignment('assignment-1', 'teacher-outsider')).rejects.toThrow('ASSIGNMENT_NOT_FOUND')
  })

  it('persists a submission file once and rejects a different student', async () => {
    const first = await appendSubmissionFile('assignment-1_student-1', studentId, file)
    const retry = await appendSubmissionFile('assignment-1_student-1', studentId, file)
    expect(first.files).toEqual([file])
    expect(retry.files).toEqual([file])
    await expect(appendSubmissionFile('assignment-1_student-1', 'student-outsider', { ...file, id: 'drive-file-2' })).rejects.toThrow('SUBMISSION_NOT_FOUND')
    expect(fake.collections.get('submissions')!.get('assignment-1_student-1')!.files).toEqual([file])
  })
})
