import { describe, expect, it } from 'vitest'
import { normalizeWord, scoreSingleWord, soundKey } from './pronunciation-scoring'

describe('scoreSingleWord', () => {
  it('gives a perfect score when the recognizer hears the target word', () => {
    const result = scoreSingleWord({ target: 'thorough', transcript: 'thorough' })
    expect(result.score).toBe(100)
    expect(result.verdict).toBe('correct')
    expect(result.heardWord).toBe('thorough')
    expect(result.segments.every((segment) => segment.match)).toBe(true)
  })

  it('scores a dropped /θ/ as a near miss rather than a failure', () => {
    const result = scoreSingleWord({ target: 'thorough', transcript: 'torough' })
    expect(result.score).toBeGreaterThan(65)
    expect(result.score).toBeLessThan(100)
    expect(result.verdict).toBe('close')
    expect(result.segments.some((segment) => !segment.match)).toBe(true)
  })

  it('scores an unrelated word as incorrect', () => {
    const result = scoreSingleWord({ target: 'thorough', transcript: 'banana' })
    expect(result.score).toBeLessThan(65)
    expect(result.verdict).toBe('incorrect')
  })

  it('scores the best token when the recognizer returns several words', () => {
    const result = scoreSingleWord({ target: 'recipe', transcript: 'the recipe please' })
    expect(result.heardWord).toBe('recipe')
    expect(result.score).toBe(100)
    expect(result.feedback).toContain('3 kata')
  })

  it('accepts the homophone the recognizer picked instead of the target', () => {
    const clothes = scoreSingleWord({ target: 'clothes', transcript: 'Close.' })
    expect(clothes.score).toBe(100)
    expect(clothes.verdict).toBe('correct')
    expect(clothes.feedback).toContain('berbunyi sama')

    const thorough = scoreSingleWord({ target: 'thorough', transcript: 'Thoreau.' })
    expect(thorough.score).toBe(100)
    expect(thorough.verdict).toBe('correct')
  })

  it('reports an empty transcript instead of inventing a score', () => {
    const result = scoreSingleWord({ target: 'island', transcript: '   ' })
    expect(result.score).toBe(1)
    expect(result.verdict).toBe('incorrect')
    expect(result.segments).toEqual([])
  })

  it('keeps the score inside the 1-100 range', () => {
    for (const transcript of ['', 'a', 'zzzzzzzzzzzzzzzzzzzz', 'comfortable']) {
      const result = scoreSingleWord({ target: 'comfortable', transcript })
      expect(result.score).toBeGreaterThanOrEqual(1)
      expect(result.score).toBeLessThanOrEqual(100)
    }
  })
})

describe('soundKey', () => {
  it('collapses spellings that sound the same', () => {
    expect(soundKey('thorough')).toBe(soundKey('thoro'))
    expect(soundKey('pharmacy')).toBe(soundKey('farmacy'))
  })

  it('normalizes case and punctuation', () => {
    expect(normalizeWord('  Colleague! ')).toBe('colleague')
  })
})
