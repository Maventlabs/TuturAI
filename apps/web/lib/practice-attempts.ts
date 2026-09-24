import { Timestamp } from 'firebase-admin/firestore'
import type { LearningContentType } from '@tuturai/domain'
import { getAdminDb } from '@/lib/firebase/admin'

export type PracticeAttemptInput = {
  questionId: string
  contentType: Extract<LearningContentType, 'pronunciation' | 'speaking' | 'conversation'>
  idempotencyKey: string
}

export function validatePracticeAttemptInput(input: unknown):
  | { success: true; data: PracticeAttemptInput }
  | { success: false; message: string } {
  if (!input || typeof input !== 'object') return { success: false, message: 'Practice attempt payload is required' }

  const value = input as Record<string, unknown>
  const questionId = typeof value.questionId === 'string' ? value.questionId.trim() : ''
  const contentType = value.contentType
  const idempotencyKey = typeof value.idempotencyKey === 'string' ? value.idempotencyKey.trim() : ''

  if (!questionId || questionId.length > 128) return { success: false, message: 'Question id is required' }
  if (!idempotencyKey || idempotencyKey.length > 128) return { success: false, message: 'Idempotency key is required' }
  if (!['pronunciation', 'speaking', 'conversation'].includes(String(contentType))) return { success: false, message: 'Unsupported practice type' }

  return { success: true, data: { questionId, contentType: contentType as PracticeAttemptInput['contentType'], idempotencyKey } }
}

export async function createPracticeAttempt(studentId: string, input: PracticeAttemptInput) {
  const db = getAdminDb()
  const question = await db.collection('questionBank').doc(input.questionId).get()
  if (!question.exists || question.data()?.status !== 'published' || question.data()?.contentType !== input.contentType) {
    throw new Error('QUESTION_NOT_FOUND')
  }

  const id = `practice-${Buffer.from(`${studentId}:${input.idempotencyKey}`).toString('base64url')}`
  const reference = db.collection('practiceAttempts').doc(id)
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(reference)
    if (existing.exists) return
    transaction.create(reference, {
      studentId,
      questionId: input.questionId,
      contentType: input.contentType,
      idempotencyKey: input.idempotencyKey,
      assessmentStatus: 'provider_unavailable',
      score: null,
      createdAt: Timestamp.now(),
    })
  })

  return { id: reference.id, assessmentStatus: 'provider_unavailable' as const, score: null }
}
