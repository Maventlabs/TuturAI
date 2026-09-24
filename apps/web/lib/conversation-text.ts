import { Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'

const STOP_WORDS = new Set(['about', 'after', 'again', 'and', 'are', 'could', 'from', 'have', 'into', 'that', 'the', 'this', 'what', 'when', 'with', 'would', 'your'])

export type ConversationTextInput = {
  questionId: string
  attemptId: string
  sessionId?: string
  answer: string
}

export function validateConversationTextInput(input: unknown):
  | { success: true; data: ConversationTextInput }
  | { success: false; message: string } {
  if (!input || typeof input !== 'object') return { success: false, message: 'Conversation answer is required' }
  const value = input as Record<string, unknown>
  const questionId = typeof value.questionId === 'string' ? value.questionId.trim() : ''
  const attemptId = typeof value.attemptId === 'string' ? value.attemptId.trim() : ''
  const sessionId = typeof value.sessionId === 'string' ? value.sessionId.trim() : undefined
  const answer = typeof value.answer === 'string' ? value.answer.trim() : ''
  if (!questionId || questionId.length > 128) return { success: false, message: 'Question id is required' }
  if (!attemptId || attemptId.length > 128) return { success: false, message: 'Attempt id is required' }
  if (sessionId && sessionId.length > 128) return { success: false, message: 'Session id is invalid' }
  if (answer.length < 3 || answer.length > 2000) return { success: false, message: 'Answer must contain 3-2000 characters' }
  return { success: true, data: { questionId, attemptId, ...(sessionId ? { sessionId } : {}), answer } }
}

function words(value: string) {
  return new Set(value.toLowerCase().match(/[a-z]+/g) ?? [])
}

export function scoreConversationText(answer: string, prompt: string) {
  const answerWords = words(answer)
  const targetWords = [...words(prompt)].filter((word) => word.length > 3 && !STOP_WORDS.has(word))
  const overlap = targetWords.filter((word) => answerWords.has(word)).length
  const relevance = targetWords.length ? overlap / targetWords.length : 0
  const completeness = Math.min(answerWords.size / 18, 1)
  const score = Math.round(Math.min(100, 35 + relevance * 45 + completeness * 20))
  return {
    score,
    feedback: score >= 80 ? 'Jawaban relevan dan cukup lengkap.' : score >= 60 ? 'Jawaban sudah relevan, tambahkan detail.' : 'Jawaban perlu lebih banyak detail yang terkait skenario.',
    metadata: { rubric: 'keyword-relevance-v1', relevance: Math.round(relevance * 100) / 100, completeness: Math.round(completeness * 100) / 100 },
  }
}

export async function assessConversationText(studentId: string, input: ConversationTextInput) {
  const db = getAdminDb()
  const question = await db.collection('questionBank').doc(input.questionId).get()
  if (!question.exists || question.data()?.status !== 'published' || question.data()?.contentType !== 'conversation') throw new Error('QUESTION_NOT_FOUND')
  const reference = db.collection('conversationTextAttempts').doc(`${studentId}_${input.attemptId}`)
  const existing = await reference.get()
  if (existing.exists) return existing.data()
  const result = scoreConversationText(input.answer, question.data()?.prompt ?? '')
  const data = { id: reference.id, studentId, questionId: input.questionId, attemptId: input.attemptId, ...(input.sessionId ? { sessionId: input.sessionId } : {}), answer: input.answer, score: result.score, feedback: result.feedback, metadata: result.metadata, createdAt: Timestamp.now() }
  await reference.create(data)
  return data
}
