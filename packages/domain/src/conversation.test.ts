import { describe, expect, it } from 'vitest'
import {
  CONVERSATION_STARTERS,
  conversationLevelFromNumber,
  conversationOpening,
  normalizeConversationReply,
  normalizeConversationSummary,
  sanitizeSpokenText,
} from './conversation'

describe('sanitizeSpokenText', () => {
  it('removes markdown, links, and emoji so the voice never reads them', () => {
    const text = sanitizeSpokenText('**Great** job! [Listen](https://x.test) `think` 🎉')
    expect(text).toBe('Great job! Listen think')
  })

  it('collapses whitespace', () => {
    expect(sanitizeSpokenText('  hello   there \n\n friend ')).toBe('hello there friend')
  })
})

describe('normalizeConversationReply', () => {
  const valid = {
    spoken_response: 'Oh, that is nice! What position do you usually play?',
    response_intent: 'follow_up',
    corrections: [
      {
        original: 'I like play football in weekend.',
        corrected: 'I like playing football on weekends.',
        category: 'grammar',
        severity: 'important',
        explanation: "Setelah 'like' gunakan verb-ing, dan ungkapan yang tepat adalah 'on weekends'.",
      },
    ],
    vocabulary_notes: [{ word_or_phrase: 'on weekends', meaning_id: 'pada akhir pekan', example_en: 'I rest on weekends.' }],
    suggested_expression: null,
    should_continue: true,
  }

  it('accepts the snake_case contract and maps it to the domain shape', () => {
    const result = normalizeConversationReply(valid)
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.spokenResponse).toBe(valid.spoken_response)
    expect(result.data.intent).toBe('follow_up')
    expect(result.data.corrections).toHaveLength(1)
    expect(result.data.corrections[0].corrected).toBe('I like playing football on weekends.')
    expect(result.data.vocabularyNotes[0].phrase).toBe('on weekends')
    expect(result.data.suggestedExpression).toBeNull()
    expect(result.data.shouldContinue).toBe(true)
  })

  it('rejects a reply without a spoken response', () => {
    const result = normalizeConversationReply({ spoken_response: '   ', corrections: [] })
    expect(result.success).toBe(false)
  })

  it('rejects a non-object payload', () => {
    expect(normalizeConversationReply('hello').success).toBe(false)
    expect(normalizeConversationReply(null).success).toBe(false)
  })

  it('drops malformed corrections and keeps at most two', () => {
    const result = normalizeConversationReply({
      spoken_response: 'Nice! Tell me more.',
      corrections: [
        { original: 'a', corrected: 'b', explanation: 'ok' },
        { original: 'c', corrected: 'c', explanation: 'identical is dropped' },
        { original: 'd', corrected: 'e' },
        { original: 'f', corrected: 'g', explanation: 'third valid' },
      ],
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.corrections).toHaveLength(2)
    expect(result.data.corrections.map((item) => item.original)).toEqual(['a', 'f'])
  })

  it('strips markup from the spoken response', () => {
    const result = normalizeConversationReply({ spoken_response: '**Hello** there!' })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.spokenResponse).toBe('Hello there!')
  })

  it('defaults an unknown intent instead of failing the turn', () => {
    const result = normalizeConversationReply({ spoken_response: 'Hi!', response_intent: 'unknown' })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.intent).toBe('follow_up')
  })
})

describe('normalizeConversationSummary', () => {
  it('rejects a summary without overview text', () => {
    expect(normalizeConversationSummary({ grammar: [] }).success).toBe(false)
  })

  it('caps recommendations at three and keeps evidence flags', () => {
    const result = normalizeConversationSummary({
      overview: { duration_minutes: 6, turns: 4, topics: ['Travel'], summary: 'Kamu berlatih bercerita tentang perjalanan.' },
      recommendations: ['a', 'b', 'c', 'd'],
      sufficient_evidence: false,
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.recommendations).toEqual(['a', 'b', 'c'])
    expect(result.data.sufficientEvidence).toBe(false)
    expect(result.data.overview.durationMinutes).toBe(6)
  })
})

describe('conversation level mapping', () => {
  it('maps the gamified level onto a difficulty band', () => {
    expect(conversationLevelFromNumber(1)).toBe('beginner')
    expect(conversationLevelFromNumber(3)).toBe('beginner')
    expect(conversationLevelFromNumber(4)).toBe('intermediate')
    expect(conversationLevelFromNumber(6)).toBe('intermediate')
    expect(conversationLevelFromNumber(7)).toBe('advanced')
    expect(conversationLevelFromNumber(Number.NaN)).toBe('beginner')
  })

  it('gives every starter an opening for every level', () => {
    for (const starter of CONVERSATION_STARTERS) {
      for (const level of ['beginner', 'intermediate', 'advanced'] as const) {
        expect(starter.openings[level].length).toBeGreaterThan(10)
      }
    }
  })

  it('falls back to a generic opening for an unknown topic', () => {
    expect(conversationOpening('beginner', 'not-a-topic')).toContain('English tutor')
    expect(conversationOpening('intermediate', 'travel')).toBe(
      CONVERSATION_STARTERS.find((starter) => starter.id === 'travel')?.openings.intermediate,
    )
  })
})
