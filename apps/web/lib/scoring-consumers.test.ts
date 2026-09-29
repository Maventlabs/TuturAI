/**
 * SCORING-016 — Analytics/adaptive canonical consumption verification.
 *
 * Confirms the aggregate consumers read persisted canonical `overall`/dimension
 * values, reject non-canonical values, and never re-derive scores client-side.
 */
import { describe, expect, it } from 'vitest'
import { buildTeacherAnalytics } from './teacher-analytics'
import { buildAdaptivePlan } from './adaptive'
import { buildTeacherLeaderboard } from './teacher-leaderboard'
import type { QuestionBankItem } from '@tuturai/domain'

const classroom = { id: 'class-1', name: 'XI IPA 1', studentCount: 2 }

describe('teacher analytics consume canonical assessment values (SCORING-016)', () => {
  it('averages persisted canonical overall values only', () => {
    const result = buildTeacherAnalytics({
      classrooms: [classroom],
      attempts: [],
      assessments: [
        { studentId: 's1', overall: 79.5, fluency: 63, createdAt: '2026-09-01T00:00:00Z' },
        { studentId: 's2', overall: 80.5, fluency: 70, createdAt: '2026-09-02T00:00:00Z' },
      ],
    })
    expect(result.summary.averageSpeakingScore).toBe(80)
    expect(result.speaking).toEqual({ available: true, assessmentCount: 2 })
  })

  it('rejects non-canonical overall values instead of averaging them', () => {
    const result = buildTeacherAnalytics({
      classrooms: [classroom],
      attempts: [],
      assessments: [
        { studentId: 's1', overall: 80, createdAt: '2026-09-01T00:00:00Z' },
        { studentId: 's2', overall: 150, createdAt: '2026-09-02T00:00:00Z' },
        { studentId: 's3', overall: -5, createdAt: '2026-09-02T00:00:00Z' },
      ],
    })
    expect(result.summary.averageSpeakingScore).toBe(80)
    expect(result.speaking.assessmentCount).toBe(1)
  })

  it('keeps fluency distribution from canonical fluency dimensions only', () => {
    const result = buildTeacherAnalytics({
      classrooms: [classroom],
      attempts: [],
      assessments: [
        { studentId: 's1', overall: 80, fluency: 59, createdAt: '2026-09-01T00:00:00Z' },
        { studentId: 's2', overall: 70, fluency: 75, createdAt: '2026-09-01T00:00:00Z' },
        { studentId: 's3', overall: 90, fluency: 88, createdAt: '2026-09-01T00:00:00Z' },
      ],
    })
    expect(result.fluencyDistribution).toEqual([
      { label: '0-59', count: 1 },
      { label: '60-79', count: 1 },
      { label: '80-100', count: 1 },
    ])
  })
})

describe('adaptive consumers use canonical persisted scores (SCORING-016)', () => {
  const question = {
    id: 'q-grammar-1',
    skill: 'grammar',
    level: 'beginner',
    contentType: 'multiple_choice',
    prompt: 'Choose the correct form.',
    word: 'eats',
    tags: ['grammar'],
    options: ['eat', 'eats'],
  } as unknown as QuestionBankItem

  it('prioritizes the weakest canonical dimension from persisted assessments', () => {
    const plan = buildAdaptivePlan({
      questions: [question],
      attempts: [],
      assessments: [{ pronunciation: 90, fluency: 88, intonation: 91, grammar: 55, vocabulary: 84 }],
    })
    expect(plan.recommendation).not.toBeNull()
    expect(plan.reason).toContain('grammar')
  })

  it('keeps canonical activity scores instead of re-deriving them', () => {
    const plan = buildAdaptivePlan({
      questions: [question],
      attempts: [{ questionId: question.id, score: 65 }],
      assessments: [],
    })
    expect(plan.activities[0]?.score).toBe(65)
  })
})

describe('leaderboard preserves server canonical ranking (SCORING-016)', () => {
  it('ranks strictly by canonical XP without letting names reorder the podium', () => {
    const ranking = buildTeacherLeaderboard([
      { studentId: 's-low', name: 'Alpha', classId: 'class-1', className: 'XI IPA 1', xp: 40, speakingScore: 50 },
      { studentId: 's-high', name: 'Zulu', classId: 'class-1', className: 'XI IPA 1', xp: 120, speakingScore: 92 },
      { studentId: 's-mid', name: 'Mike', classId: 'class-1', className: 'XI IPA 1', xp: 80, speakingScore: 70 },
    ])
    expect(ranking.map((entry) => entry.studentId)).toEqual(['s-high', 's-mid', 's-low'])
    expect(ranking.map((entry) => entry.rank)).toEqual([1, 2, 3])
  })
})
