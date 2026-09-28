import { Timestamp } from 'firebase-admin/firestore'
import type { NormalizedPronunciationResult } from '@/lib/ai/pronunciation-provider'
import { getAdminDb } from '@/lib/firebase/admin'

export interface PronunciationAttemptInput {
  studentId: string
  questionId: string
  idempotencyKey: string
  requestHash: string
}

export interface StoredPronunciationResult extends NormalizedPronunciationResult {
  id: string
  studentId: string
  questionId: string
  createdAt: string
}

export function pronunciationResultId(studentId: string, idempotencyKey: string) {
  return `pronunciation-${Buffer.from(`${studentId}:${idempotencyKey}`).toString('base64url')}`
}

function practiceAttemptId(studentId: string, idempotencyKey: string) {
  return `practice-${Buffer.from(`${studentId}:${idempotencyKey}`).toString('base64url')}`
}

function toIso(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (value instanceof Date) return value.toISOString()
  return typeof value === 'string' ? value : new Date(0).toISOString()
}

function publicResult(id: string, data: Record<string, unknown>): StoredPronunciationResult {
  return {
    id,
    studentId: String(data.studentId),
    questionId: String(data.questionId),
    targetText: String(data.targetText),
    transcript: String(data.transcript),
    score: data.score as number,
    confidence: typeof data.confidence === 'number' ? data.confidence : null,
    feedback: String(data.feedback),
    words: data.words as StoredPronunciationResult['words'],
    createdAt: toIso(data.createdAt),
  }
}

export async function getStudentPronunciationResult(studentId: string, id: string) {
  const snapshot = await getAdminDb().collection('pronunciationResults').doc(id).get()
  if (!snapshot.exists || snapshot.data()?.studentId !== studentId) return null
  return publicResult(snapshot.id, snapshot.data() ?? {})
}

export async function getStudentPronunciationAttemptState(studentId: string, idempotencyKey: string) {
  const db = getAdminDb()
  const resultRef = db.collection('pronunciationResults').doc(pronunciationResultId(studentId, idempotencyKey))
  const attemptRef = db.collection('practiceAttempts').doc(practiceAttemptId(studentId, idempotencyKey))
  const [resultSnapshot, attemptSnapshot] = await Promise.all([resultRef.get(), attemptRef.get()])
  const resultData = resultSnapshot.data()
  const attemptData = attemptSnapshot.data()
  const result = resultSnapshot.exists && resultData?.studentId === studentId
    ? publicResult(resultSnapshot.id, resultData)
    : null
  return {
    result,
    requestHash: typeof resultData?.requestHash === 'string'
      ? resultData.requestHash
      : typeof attemptData?.requestHash === 'string' ? attemptData.requestHash : null,
    status: typeof attemptData?.assessmentStatus === 'string' ? attemptData.assessmentStatus : null,
  }
}

export async function saveStudentPronunciationResult(input: PronunciationAttemptInput & {
  result: NormalizedPronunciationResult
  modelId: string
}) {
  const db = getAdminDb()
  const resultId = pronunciationResultId(input.studentId, input.idempotencyKey)
  const resultRef = db.collection('pronunciationResults').doc(resultId)
  const attemptRef = db.collection('practiceAttempts').doc(practiceAttemptId(input.studentId, input.idempotencyKey))
  const questionRef = db.collection('questionBank').doc(input.questionId)
  return db.runTransaction(async (transaction) => {
    const [resultSnapshot, attemptSnapshot, questionSnapshot] = await Promise.all([
      transaction.get(resultRef),
      transaction.get(attemptRef),
      transaction.get(questionRef),
    ])
    if (!questionSnapshot.exists || questionSnapshot.data()?.status !== 'published' || questionSnapshot.data()?.contentType !== 'pronunciation') {
      throw new Error('QUESTION_NOT_FOUND')
    }
    if (resultSnapshot.exists) {
      if (resultSnapshot.data()?.requestHash !== input.requestHash) throw new Error('IDEMPOTENCY_KEY_REUSED')
      return publicResult(resultSnapshot.id, resultSnapshot.data() ?? {})
    }
    if (attemptSnapshot.exists && attemptSnapshot.data()?.requestHash !== input.requestHash) {
      throw new Error('IDEMPOTENCY_KEY_REUSED')
    }
    const now = Timestamp.now()
    const stored = {
      studentId: input.studentId,
      questionId: input.questionId,
      targetText: input.result.targetText,
      transcript: input.result.transcript,
      score: input.result.score,
      confidence: input.result.confidence,
      feedback: input.result.feedback,
      words: input.result.words,
      providerModelId: input.modelId,
      requestHash: input.requestHash,
      createdAt: now,
    }
    transaction.create(resultRef, stored)
    transaction.set(attemptRef, {
      studentId: input.studentId,
      questionId: input.questionId,
      contentType: 'pronunciation',
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      assessmentStatus: 'completed',
      score: input.result.score,
      errorCode: null,
      retryable: false,
      pronunciationResultId: resultId,
      createdAt: attemptSnapshot.exists ? attemptSnapshot.data()?.createdAt ?? now : now,
      updatedAt: now,
    })
    return publicResult(resultId, stored)
  })
}

export async function recordPronunciationFailure(input: PronunciationAttemptInput & {
  errorCode: string
  retryable: boolean
}) {
  const db = getAdminDb()
  const resultId = pronunciationResultId(input.studentId, input.idempotencyKey)
  const resultRef = db.collection('pronunciationResults').doc(resultId)
  const attemptRef = db.collection('practiceAttempts').doc(practiceAttemptId(input.studentId, input.idempotencyKey))
  const questionRef = db.collection('questionBank').doc(input.questionId)
  return db.runTransaction(async (transaction) => {
    const [resultSnapshot, attemptSnapshot, questionSnapshot] = await Promise.all([
      transaction.get(resultRef),
      transaction.get(attemptRef),
      transaction.get(questionRef),
    ])
    if (!questionSnapshot.exists || questionSnapshot.data()?.status !== 'published' || questionSnapshot.data()?.contentType !== 'pronunciation') {
      throw new Error('QUESTION_NOT_FOUND')
    }
    if (resultSnapshot.exists) {
      if (resultSnapshot.data()?.requestHash !== input.requestHash) throw new Error('IDEMPOTENCY_KEY_REUSED')
      return { status: 'completed' as const, result: publicResult(resultSnapshot.id, resultSnapshot.data() ?? {}) }
    }
    if (attemptSnapshot.exists && attemptSnapshot.data()?.requestHash !== input.requestHash) {
      throw new Error('IDEMPOTENCY_KEY_REUSED')
    }
    const now = Timestamp.now()
    transaction.set(attemptRef, {
      studentId: input.studentId,
      questionId: input.questionId,
      contentType: 'pronunciation',
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      assessmentStatus: 'failed',
      score: null,
      errorCode: input.errorCode,
      retryable: input.retryable,
      createdAt: attemptSnapshot.exists ? attemptSnapshot.data()?.createdAt ?? now : now,
      updatedAt: now,
    })
    return { status: 'failed' as const, resultId }
  })
}
