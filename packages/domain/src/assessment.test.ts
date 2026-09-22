import { describe, expect, it } from 'vitest'
import { normalizeAssessment } from './assessment'

describe('normalizeAssessment', () => {
  it('accepts a complete provider result without changing scores', () => {
    expect(
      normalizeAssessment({
        pronunciation: 82,
        fluency: 76,
        intonation: 80,
        grammar: 74,
        vocabulary: 88,
        overall: 80,
        transcript: 'I enjoy learning English.',
        feedback: 'Good pacing.',
        confidence: 0.91,
      }),
    ).toEqual({
      success: true,
      data: {
        pronunciation: 82,
        fluency: 76,
        intonation: 80,
        grammar: 74,
        vocabulary: 88,
        overall: 80,
        transcript: 'I enjoy learning English.',
        feedback: 'Good pacing.',
        confidence: 0.91,
      },
    })
  })

  it('rejects incomplete provider output', () => {
    const result = normalizeAssessment({ transcript: 'hello', overall: 80 })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.issues).toContain('pronunciation must be a number between 0 and 100')
    expect(result.issues).toContain('feedback is required')
  })
})
