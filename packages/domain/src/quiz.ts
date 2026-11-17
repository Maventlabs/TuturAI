import { clampAttemptScore } from './xp'
import type { QuestionLevel } from './question'

/**
 * Integrated quiz contract: one 30-question exam across three equally weighted
 * sections, scored on the same 1..100 scale as every other TuturAI attempt.
 *
 * The composition is fixed by the product spec and must not drift: 10 reading
 * questions drawn from 2 passages, 10 listening questions, 10 general
 * questions, 30 minutes.
 */

export const QUIZ_SECTION_IDS = ['reading', 'listening', 'general'] as const
export type QuizSectionId = (typeof QUIZ_SECTION_IDS)[number]

export const QUIZ_LEVELS: readonly QuestionLevel[] = ['beginner', 'intermediate', 'advanced']

export const QUIZ_QUESTIONS_PER_SECTION = 10
export const QUIZ_TOTAL_QUESTIONS = QUIZ_QUESTIONS_PER_SECTION * QUIZ_SECTION_IDS.length
export const QUIZ_DURATION_MS = 30 * 60 * 1_000
export const QUIZ_READING_PASSAGE_COUNT = 2
export const QUIZ_QUESTIONS_PER_PASSAGE = 5

/** Equal contribution per section; the three weights sum to exactly 1. */
export const QUIZ_SECTION_WEIGHTS: Record<QuizSectionId, number> = {
  reading: 1 / 3,
  listening: 1 / 3,
  general: 1 / 3,
}

export const QUIZ_SECTION_LABELS: Record<QuizSectionId, string> = {
  reading: 'Reading Comprehension',
  listening: 'Listening Comprehension',
  general: 'General Questions',
}

export type QuizAttemptStatus = 'in_progress' | 'submitted' | 'expired'

export interface QuizSectionTally {
  correct: number
  incorrect: number
  unanswered: number
}

export interface QuizSectionScore extends QuizSectionTally {
  section: QuizSectionId
  total: number
  score: number
}

export interface QuizScore {
  finalScore: number
  sections: QuizSectionScore[]
  correct: number
  incorrect: number
  unanswered: number
  total: number
}

function safeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
}

/** Section score on the 0..100 scale. An empty section scores 0, never NaN. */
export function calculateQuizSectionScore(correct: number, total: number): number {
  const safeTotal = safeCount(total)
  if (safeTotal === 0) return 0
  const safeCorrect = Math.min(safeCount(correct), safeTotal)
  return Math.round((safeCorrect / safeTotal) * 100)
}

/**
 * Canonical quiz score. Each section is scored on its own 0..100 scale, then
 * combined with equal weights and clamped onto the platform's 1..100 attempt
 * scale — the same clamp every other TuturAI attempt uses.
 */
export function calculateQuizScore(input: Record<QuizSectionId, QuizSectionTally>): QuizScore {
  const sections = QUIZ_SECTION_IDS.map((section) => {
    const tally = input[section] ?? { correct: 0, incorrect: 0, unanswered: 0 }
    const correct = safeCount(tally.correct)
    const incorrect = safeCount(tally.incorrect)
    const unanswered = safeCount(tally.unanswered)
    const total = correct + incorrect + unanswered
    return {
      section,
      correct,
      incorrect,
      unanswered,
      total,
      score: calculateQuizSectionScore(correct, total),
    }
  })

  const weighted = sections.reduce(
    (sum, section) => sum + section.score * QUIZ_SECTION_WEIGHTS[section.section],
    0,
  )

  return {
    finalScore: clampAttemptScore(weighted),
    sections,
    correct: sections.reduce((sum, section) => sum + section.correct, 0),
    incorrect: sections.reduce((sum, section) => sum + section.incorrect, 0),
    unanswered: sections.reduce((sum, section) => sum + section.unanswered, 0),
    total: sections.reduce((sum, section) => sum + section.total, 0),
  }
}

/** Milliseconds left on the server-owned deadline. Never negative. */
export function remainingQuizMs(deadlineMs: number, nowMs: number): number {
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(nowMs)) return 0
  return Math.max(0, deadlineMs - nowMs)
}

export function formatQuizClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil((Number.isFinite(ms) ? ms : 0) / 1_000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function isQuizLevel(value: unknown): value is QuestionLevel {
  return typeof value === 'string' && (QUIZ_LEVELS as readonly string[]).includes(value)
}

export function validateQuizStartInput(input: unknown):
  | { success: true; data: { level: QuestionLevel } }
  | { success: false; issues: Array<{ path: string; message: string }> } {
  if (!input || typeof input !== 'object') {
    return { success: false, issues: [{ path: 'root', message: 'Quiz start payload is required' }] }
  }
  const level = (input as Record<string, unknown>).level
  if (!isQuizLevel(level)) {
    return { success: false, issues: [{ path: 'level', message: 'Level must be beginner, intermediate, or advanced' }] }
  }
  return { success: true, data: { level } }
}

export function validateQuizAnswerInput(input: unknown):
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

/** A question as the exam client sees it: never carries the answer key. */
export interface QuizQuestionView {
  id: string
  section: QuizSectionId
  prompt: string
  options: string[]
  passageId?: string
  audioUrl?: string
  questionType?: string
}

export interface QuizPassageView {
  id: string
  title: string
  paragraphs: string[]
  questionIds: string[]
}

export interface QuizReviewItem {
  questionId: string
  section: QuizSectionId
  prompt: string
  options: string[]
  selectedOption: number | null
  correctOption: number
  isCorrect: boolean
  explanation: string
  passageId?: string
  audioUrl?: string
}

export interface QuizResultView {
  finalScore: number
  sections: QuizSectionScore[]
  correct: number
  incorrect: number
  unanswered: number
  total: number
  durationSeconds: number
  submittedAt: string
  status: QuizAttemptStatus
  review: QuizReviewItem[]
}

export interface QuizAttemptView {
  id: string
  level: QuestionLevel
  status: QuizAttemptStatus
  startedAt: string
  deadlineAt: string
  serverNow: string
  remainingMs: number
  questions: QuizQuestionView[]
  passages: QuizPassageView[]
  answers: Record<string, number>
  result: QuizResultView | null
}

export interface QuizAttemptSummary {
  id: string
  level: QuestionLevel
  status: QuizAttemptStatus
  startedAt: string
  submittedAt: string | null
  finalScore: number | null
  correct: number | null
  total: number
}
