import type { QuestionLevel } from './question'

/**
 * Reading practice contract: one session is two passages with five questions
 * each, drawn from a single level so a beginner never meets advanced material.
 *
 * The shape mirrors the reading section of the integrated quiz, but a practice
 * session has no deadline: the student reads at their own pace and the server
 * still owns the answer key and the score.
 */

export const READING_LEVELS: readonly QuestionLevel[] = ['beginner', 'intermediate', 'advanced']
export const READING_PASSAGE_COUNT = 2
export const READING_QUESTIONS_PER_PASSAGE = 5
export const READING_TOTAL_QUESTIONS = READING_PASSAGE_COUNT * READING_QUESTIONS_PER_PASSAGE

export type ReadingSessionStatus = 'in_progress' | 'submitted' | 'abandoned'

/** A question as the practice client sees it: never carries the answer key. */
export interface ReadingQuestionView {
  id: string
  passageId: string
  prompt: string
  options: string[]
  questionType?: string
}

export interface ReadingPassageView {
  id: string
  title: string
  topic?: string
  paragraphs: string[]
  questionIds: string[]
}

export interface ReadingReviewItem {
  questionId: string
  passageId: string
  prompt: string
  options: string[]
  selectedOption: number | null
  correctOption: number
  isCorrect: boolean
  explanation: string
  questionType?: string
}

export interface ReadingResultView {
  score: number
  correct: number
  incorrect: number
  unanswered: number
  total: number
  durationSeconds: number
  submittedAt: string
  review: ReadingReviewItem[]
}

export interface ReadingSessionView {
  id: string
  level: QuestionLevel
  status: ReadingSessionStatus
  startedAt: string
  submittedAt: string | null
  questions: ReadingQuestionView[]
  passages: ReadingPassageView[]
  answers: Record<string, number>
  result: ReadingResultView | null
}

export interface ReadingAttemptSummary {
  id: string
  level: QuestionLevel
  status: ReadingSessionStatus
  startedAt: string
  submittedAt: string | null
  score: number | null
  correct: number | null
  total: number
}

export interface ReadingLevelStat {
  level: QuestionLevel
  passages: number
  questions: number
  attempts: number
  bestScore: number | null
}

function safeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
}

/**
 * Practice score on the 0..100 scale. Unlike an assessed attempt, a practice
 * session may honestly score zero, so the 1..100 attempt floor is not applied
 * here; XP still goes through the platform's clamp.
 */
export function calculateReadingScore(correct: number, total: number): number {
  const safeTotal = safeCount(total)
  if (safeTotal === 0) return 0
  return Math.round((Math.min(safeCount(correct), safeTotal) / safeTotal) * 100)
}

export function isReadingLevel(value: unknown): value is QuestionLevel {
  return typeof value === 'string' && (READING_LEVELS as readonly string[]).includes(value)
}

export function validateReadingStartInput(input: unknown):
  | { success: true; data: { level: QuestionLevel } }
  | { success: false; issues: Array<{ path: string; message: string }> } {
  if (!input || typeof input !== 'object') {
    return { success: false, issues: [{ path: 'root', message: 'Reading start payload is required' }] }
  }
  const level = (input as Record<string, unknown>).level
  if (!isReadingLevel(level)) {
    return { success: false, issues: [{ path: 'level', message: 'Level must be beginner, intermediate, or advanced' }] }
  }
  return { success: true, data: { level } }
}

export function validateReadingAnswerInput(input: unknown):
  | { success: true; data: { questionId: string; selectedOption: number } }
  | { success: false; issues: Array<{ path: string; message: string }> } {
  if (!input || typeof input !== 'object') {
    return { success: false, issues: [{ path: 'root', message: 'Answer payload is required' }] }
  }
  const value = input as Record<string, unknown>
  const issues: Array<{ path: string; message: string }> = []
  const questionId = typeof value.questionId === 'string' ? value.questionId.trim() : ''
  const selectedOption = value.selectedOption

  if (!questionId || questionId.length > 128) issues.push({ path: 'questionId', message: 'Question id is required' })
  if (!Number.isInteger(selectedOption) || (selectedOption as number) < 0 || (selectedOption as number) > 20) {
    issues.push({ path: 'selectedOption', message: 'Selected option must be an integer from 0-20' })
  }

  if (issues.length > 0) return { success: false, issues }
  return { success: true, data: { questionId, selectedOption: selectedOption as number } }
}
