import { describe, expect, it } from 'vitest'
import { scoreConversationText, validateConversationTextInput } from './conversation-text'

describe('conversation text rubric', () => {
  it('rewards relevant and complete answers deterministically', () => {
    expect(scoreConversationText('I use technology for school and learning every day.', 'Discuss technology and learning')).toEqual({
      score: 75,
      feedback: 'Jawaban sudah relevan, tambahkan detail.',
      metadata: { rubric: 'keyword-relevance-v1', relevance: 0.67, completeness: 0.5 },
    })
  })

  it('rejects empty or oversized answers', () => {
    expect(validateConversationTextInput({ questionId: 'q', attemptId: 'a', answer: 'x' }).success).toBe(false)
  })
})
