import { describe, expect, it } from 'vitest'
import { recommendAdaptiveActivity } from './adaptive'

const activities = [
  { id: 'grammar-1', title: 'Grammar basics', dimension: 'grammar' as const, difficulty: 'intermediate' as const },
  { id: 'fluency-1', title: 'Fluency drills', dimension: 'fluency' as const, difficulty: 'intermediate' as const },
  { id: 'grammar-2', title: 'Advanced grammar', dimension: 'grammar' as const, difficulty: 'advanced' as const },
]

describe('recommendAdaptiveActivity', () => {
  it('starts at the current difficulty without assessment history', () => {
    expect(recommendAdaptiveActivity({ assessments: [], activities, currentDifficulty: 'intermediate' })).toMatchObject({
      activity: activities[0],
      difficulty: 'intermediate',
      focusDimension: null,
    })
  })

  it('focuses on the weakest dimension and increases difficulty for strong performance', () => {
    const result = recommendAdaptiveActivity({
      currentDifficulty: 'intermediate',
      activities,
      assessments: [{ pronunciation: 90, fluency: 92, intonation: 88, grammar: 55, vocabulary: 86, overall: 88 }],
    })

    expect(result.activity?.id).toBe('grammar-2')
    expect(result.focusDimension).toBe('grammar')
    expect(result.difficulty).toBe('advanced')
  })

  it('does not exceed advanced or drop below beginner', () => {
    const strong = recommendAdaptiveActivity({ currentDifficulty: 'advanced', activities, assessments: [{ pronunciation: 100, fluency: 100, intonation: 100, grammar: 100, vocabulary: 100, overall: 100 }] })
    const weak = recommendAdaptiveActivity({ currentDifficulty: 'beginner', activities, assessments: [{ pronunciation: 10, fluency: 10, intonation: 10, grammar: 10, vocabulary: 10, overall: 10 }] })
    expect(strong.difficulty).toBe('advanced')
    expect(weak.difficulty).toBe('beginner')
  })
})
