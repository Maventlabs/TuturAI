import { describe, expect, it } from 'vitest'
import {
  SPEAKING_PRACTICE_MODES,
  SPEAKING_SCENARIOS,
  SPEAKING_SESSION_TYPES,
  getSpeakingScenario,
  isSpeakingPracticeMode,
  isSpeakingSessionType,
  speakingScenarioBrief,
} from './speaking-scenarios'

describe('speaking scenario catalog', () => {
  it('ships exactly 20 scenarios with unique ids', () => {
    expect(SPEAKING_SCENARIOS).toHaveLength(20)
    expect(new Set(SPEAKING_SCENARIOS.map((scenario) => scenario.id)).size).toBe(20)
  })

  it('gives every scenario three context paragraphs and one task', () => {
    for (const scenario of SPEAKING_SCENARIOS) {
      expect(scenario.situation.length).toBeGreaterThan(60)
      expect(scenario.context.length).toBeGreaterThan(60)
      expect(scenario.objective.length).toBeGreaterThan(40)
      // A task may be phrased as a question or as an instruction, but it must be
      // a complete prompt rather than a fragment.
      expect(/[?.]$/.test(scenario.question.trim())).toBe(true)
      expect(scenario.talkingPoints.length).toBeGreaterThanOrEqual(3)
      expect(scenario.usefulExpressions.length).toBeGreaterThanOrEqual(3)
      expect(scenario.vocabulary.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps scenario content distinct', () => {
    expect(new Set(SPEAKING_SCENARIOS.map((scenario) => scenario.situation)).size).toBe(20)
    expect(new Set(SPEAKING_SCENARIOS.map((scenario) => scenario.question)).size).toBe(20)
  })

  it('covers all three difficulty bands', () => {
    const bands = new Set(SPEAKING_SCENARIOS.map((scenario) => scenario.difficulty))
    expect(bands).toEqual(new Set(['beginner', 'intermediate', 'advanced']))
  })

  it('resolves scenarios by id and rejects unknown ids', () => {
    expect(getSpeakingScenario('travel-plans')?.title).toBe('Travel Plans')
    expect(getSpeakingScenario('does-not-exist')).toBeNull()
  })

  it('withholds guided hints in Free Practice', () => {
    const scenario = getSpeakingScenario('travel-plans')
    expect(scenario).not.toBeNull()
    const free = speakingScenarioBrief(scenario!, 'free')
    expect(free.talkingPoints).toEqual([])
    expect(free.usefulExpressions).toEqual([])
    expect(free.vocabulary).toEqual([])
    expect(free.question).toBe(scenario!.question)

    const guided = speakingScenarioBrief(scenario!, 'guided')
    expect(guided.talkingPoints.length).toBeGreaterThan(0)
    expect(guided.usefulExpressions.length).toBeGreaterThan(0)
  })

  it('defines both practice modes and both session types', () => {
    expect(SPEAKING_PRACTICE_MODES.guided.showsGuidedHints).toBe(true)
    expect(SPEAKING_PRACTICE_MODES.free.showsGuidedHints).toBe(false)
    expect(SPEAKING_SESSION_TYPES.quick.maxSeconds).toBe(20)
    expect(SPEAKING_SESSION_TYPES.full.minSeconds).toBe(45)
    expect(SPEAKING_SESSION_TYPES.full.maxSeconds).toBe(90)
  })

  it('guards mode and session type values', () => {
    expect(isSpeakingPracticeMode('guided')).toBe(true)
    expect(isSpeakingPracticeMode('free')).toBe(true)
    expect(isSpeakingPracticeMode('guided ')).toBe(false)
    expect(isSpeakingSessionType('quick')).toBe(true)
    expect(isSpeakingSessionType('full')).toBe(true)
    expect(isSpeakingSessionType('medium')).toBe(false)
  })
})
