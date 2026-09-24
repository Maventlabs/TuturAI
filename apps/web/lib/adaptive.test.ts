import { describe, expect, it } from 'vitest'
import { buildAdaptivePlan } from './adaptive'
import type { QuestionBankItem } from '@tuturai/domain'

const questions: QuestionBankItem[] = [
  { id: 'grammar-1', contentType: 'question', skill: 'grammar', level: 'beginner', prompt: 'Choose the correct tense.', options: ['is', 'are'], explanation: '', tags: ['Grammar'] },
  { id: 'vocab-1', contentType: 'vocabulary', skill: 'vocabulary', level: 'intermediate', prompt: 'What does rapid mean?', options: ['Fast', 'Quiet'], explanation: '', tags: ['Vocabulary'], word: 'rapid' },
]

describe('buildAdaptivePlan', () => {
  it('recommends untouched material before completed material', () => {
    const plan = buildAdaptivePlan({
      questions,
      attempts: [{ questionId: 'grammar-1', isCorrect: true }],
    })

    expect(plan.recommendation?.id).toBe('vocab-1')
    expect(plan.activities).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'grammar-1', status: 'completed', score: 100 }),
      expect.objectContaining({ id: 'vocab-1', status: 'recommended', score: null }),
    ]))
  })

  it('returns an explicit empty state when no material is published', () => {
    const plan = buildAdaptivePlan({ questions: [], attempts: [] })

    expect(plan.recommendation).toBeNull()
    expect(plan.reason).toContain('Belum ada materi')
  })

  it('prioritizes the skill matching the weakest persisted assessment dimension', () => {
    const plan = buildAdaptivePlan({
      questions: [...questions, { id: 'speaking-1', contentType: 'speaking', skill: 'speaking', level: 'beginner', prompt: 'Describe your day.', options: [], explanation: '', tags: ['Speaking'] }],
      attempts: [],
      assessments: [{ grammar: 92, fluency: 48, pronunciation: 80 }],
    })

    expect(plan.recommendation?.skill).toBe('speaking')
    expect(plan.reason).toContain('riwayat assessment')
  })

  it('marks confirmed linked practice complete but ignores unscored provider failures', () => {
    const plan = buildAdaptivePlan({
      questions: [
        { id: 'speaking-1', contentType: 'speaking', skill: 'speaking', level: 'beginner', prompt: 'Describe your day.', options: [], explanation: '', tags: ['Speaking'] },
        { id: 'speaking-2', contentType: 'speaking', skill: 'speaking', level: 'beginner', prompt: 'Describe your room.', options: [], explanation: '', tags: ['Speaking'] },
      ],
      attempts: [
        { questionId: 'speaking-1', score: 84 },
        { questionId: 'speaking-2' },
      ],
    })

    expect(plan.activities).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'speaking-1', status: 'completed', score: 84 }),
      expect.objectContaining({ id: 'speaking-2', status: 'recommended', score: null }),
    ]))
  })

  it('does not recommend completed material when every published activity is complete', () => {
    const plan = buildAdaptivePlan({
      questions,
      attempts: [
        { questionId: 'grammar-1', isCorrect: true },
        { questionId: 'vocab-1', score: 100 },
      ],
    })

    expect(plan.recommendation).toBeNull()
    expect(plan.reason).toContain('sudah selesai')
    expect(plan.activities.every((activity) => activity.status === 'completed')).toBe(true)
  })
})
