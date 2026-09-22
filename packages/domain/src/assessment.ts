import type { NormalizedAssessment } from './types'

const scoreFields = [
  'pronunciation',
  'fluency',
  'intonation',
  'grammar',
  'vocabulary',
  'overall',
] as const

export type AssessmentResult =
  | { success: true; data: NormalizedAssessment }
  | { success: false; issues: string[] }

export function normalizeAssessment(input: unknown): AssessmentResult {
  if (!input || typeof input !== 'object') {
    return { success: false, issues: ['assessment must be an object'] }
  }

  const value = input as Record<string, unknown>
  const issues: string[] = []

  for (const field of scoreFields) {
    if (typeof value[field] !== 'number' || !Number.isFinite(value[field]) || value[field] < 0 || value[field] > 100) {
      issues.push(`${field} must be a number between 0 and 100`)
    }
  }
  if (typeof value.transcript !== 'string' || !value.transcript.trim()) issues.push('transcript is required')
  if (typeof value.feedback !== 'string' || !value.feedback.trim()) issues.push('feedback is required')
  if (value.confidence !== undefined && (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1)) {
    issues.push('confidence must be a number between 0 and 1')
  }

  if (issues.length) return { success: false, issues }

  return {
    success: true,
    data: {
      pronunciation: value.pronunciation as number,
      fluency: value.fluency as number,
      intonation: value.intonation as number,
      grammar: value.grammar as number,
      vocabulary: value.vocabulary as number,
      overall: value.overall as number,
      transcript: value.transcript as string,
      feedback: value.feedback as string,
      confidence: (value.confidence as number | undefined) ?? null,
    },
  }
}
