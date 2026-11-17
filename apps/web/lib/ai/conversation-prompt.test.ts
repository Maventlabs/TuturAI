import { describe, expect, it } from 'vitest'
import { buildConversationMessages, buildConversationSummaryPrompt } from './conversation-prompt'

describe('buildConversationMessages', () => {
  it('keeps only the most recent twelve history turns', () => {
    const history = Array.from({ length: 20 }, (_, index) => ({
      speaker: index % 2 === 0 ? ('student' as const) : ('tutor' as const),
      transcript: `turn-${index}`,
    }))

    const messages = buildConversationMessages({
      level: 'intermediate',
      topicLabel: 'Travel',
      transcript: 'I went to Bali last year.',
      history,
      recurringErrors: [],
    })

    expect(messages[0].role).toBe('system')
    expect(messages).toHaveLength(1 + 12 + 1)
    expect(messages[1].content).toBe('turn-8')
    expect(messages[messages.length - 1]).toEqual({ role: 'user', content: 'I went to Bali last year.' })
  })

  it('maps the tutor turns to the assistant role', () => {
    const messages = buildConversationMessages({
      level: 'beginner',
      topicLabel: null,
      transcript: 'Hello.',
      history: [
        { speaker: 'tutor', transcript: 'Hi! How are you?' },
        { speaker: 'student', transcript: 'I am fine.' },
      ],
      recurringErrors: [],
    })

    expect(messages.slice(1, 3)).toEqual([
      { role: 'assistant', content: 'Hi! How are you?' },
      { role: 'user', content: 'I am fine.' },
    ])
  })

  it('carries the level guide, topic, and recurring errors into the system prompt', () => {
    const messages = buildConversationMessages({
      level: 'advanced',
      topicLabel: 'Technology',
      transcript: 'Technology changed everything.',
      history: [],
      recurringErrors: ['grammar (tense, verb form, article)'],
    })

    const system = messages[0].content
    expect(system).toContain('ADVANCED')
    expect(system).toContain('Topik percakapan saat ini: Technology')
    expect(system).toContain('grammar (tense, verb form, article)')
    expect(system).toContain('spoken_response')
    expect(system).toContain('Bahasa Indonesia')
  })

  it('states that no recurring pattern is known yet', () => {
    const messages = buildConversationMessages({
      level: 'beginner',
      topicLabel: null,
      transcript: 'Hi.',
      history: [],
      recurringErrors: [],
    })

    expect(messages[0].content).toContain('Belum ada pola kesalahan yang tercatat')
  })
})

describe('buildConversationSummaryPrompt', () => {
  it('includes the transcript and counts only student turns', () => {
    const prompt = buildConversationSummaryPrompt({
      level: 'intermediate',
      topicLabel: 'Food',
      durationMinutes: 7,
      turns: [
        { speaker: 'tutor', transcript: 'What is your favorite food?' },
        { speaker: 'student', transcript: 'I like rendang.' },
        { speaker: 'tutor', transcript: 'Why do you like it?' },
        { speaker: 'student', transcript: 'Because it is rich in spice.' },
      ],
    })

    expect(prompt).toContain('Student: I like rendang.')
    expect(prompt).toContain('Jumlah turn siswa: 2')
    expect(prompt).toContain('Durasi: 7 menit')
    expect(prompt).toContain('Jangan memberi skor formal')
  })
})
