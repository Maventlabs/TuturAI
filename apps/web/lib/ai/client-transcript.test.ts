import { describe, expect, it } from 'vitest'
import {
  MAX_TRANSCRIPT_CHARS,
  TranscriptValidationError,
  countTranscriptWords,
  metricsFromServerStt,
  normalizeClientTranscript,
} from './client-transcript'

describe('client transcript normalization', () => {
  it('derives wordCount on the server instead of trusting the client', () => {
    const metrics = normalizeClientTranscript({
      transcript: 'Hello this is a short English sentence',
      reportedDurationMs: 5000,
      source: 'browser_speech_api',
    })
    // 7 words -> the client cannot claim an arbitrary count.
    expect(metrics.wordCount).toBe(7)
    expect(metrics.wordCount).toBe(countTranscriptWords('Hello this is a short English sentence'))
  })

  it('marks a browser transcript as audio-unverified', () => {
    const metrics = normalizeClientTranscript({
      transcript: 'hello world',
      reportedDurationMs: 3000,
      source: 'browser_speech_api',
    })
    expect(metrics.audioVerified).toBe(false)
  })

  it('rejects an implausibly fast duration instead of inflating fluency', () => {
    // 7 words in 1 second = 420 WPM, far beyond a learner ceiling.
    const metrics = normalizeClientTranscript({
      transcript: 'Hello this is a short English sentence',
      reportedDurationMs: 1000,
      source: 'browser_speech_api',
    })
    expect(metrics.durationPlausible).toBe(false)
    const wpm = (metrics.wordCount / metrics.spokenDurationMs) * 60_000
    expect(wpm).toBeLessThanOrEqual(200)
  })

  it('keeps a plausible duration unchanged', () => {
    const metrics = normalizeClientTranscript({
      transcript: 'hello there friend',
      reportedDurationMs: 4000,
      source: 'browser_speech_api',
    })
    expect(metrics.durationPlausible).toBe(true)
    expect(metrics.spokenDurationMs).toBe(4000)
  })

  it('rejects an empty or whitespace-only transcript', () => {
    expect(() =>
      normalizeClientTranscript({ transcript: '   ', reportedDurationMs: 3000, source: 'browser_speech_api' }),
    ).toThrow(TranscriptValidationError)
  })

  it('rejects a transcript over the length cap', () => {
    const tooLong = 'a '.repeat(MAX_TRANSCRIPT_CHARS)
    expect(() =>
      normalizeClientTranscript({ transcript: tooLong, reportedDurationMs: 3000, source: 'browser_speech_api' }),
    ).toThrow(/exceeds/)
  })

  it('rejects a transcript with no recognisable words', () => {
    expect(() =>
      normalizeClientTranscript({ transcript: '123 456 !!!', reportedDurationMs: 3000, source: 'browser_speech_api' }),
    ).toThrow(/no recognisable words/i)
  })

  it('rejects a non-positive or non-finite duration', () => {
    expect(() =>
      normalizeClientTranscript({ transcript: 'hello world', reportedDurationMs: 0, source: 'browser_speech_api' }),
    ).toThrow(TranscriptValidationError)
    expect(() =>
      normalizeClientTranscript({ transcript: 'hello world', reportedDurationMs: Number.NaN, source: 'browser_speech_api' }),
    ).toThrow(TranscriptValidationError)
    expect(() =>
      normalizeClientTranscript({ transcript: 'hello world', reportedDurationMs: -5, source: 'browser_speech_api' }),
    ).toThrow(TranscriptValidationError)
  })

  it('rejects a non-string transcript', () => {
    expect(() =>
      normalizeClientTranscript({ transcript: undefined as unknown as string, reportedDurationMs: 3000, source: 'browser_speech_api' }),
    ).toThrow(TranscriptValidationError)
  })

  it('trims surrounding whitespace before scoring', () => {
    const metrics = normalizeClientTranscript({
      transcript: '   hello world   ',
      reportedDurationMs: 3000,
      source: 'browser_speech_api',
    })
    expect(metrics.transcript).toBe('hello world')
  })
})

describe('server-side STT metrics', () => {
  it('marks audio-verified so audio-only channels stay eligible', () => {
    const metrics = metricsFromServerStt('hello from the server', 2500)
    expect(metrics.audioVerified).toBe(true)
    expect(metrics.durationPlausible).toBe(true)
    expect(metrics.wordCount).toBe(4)
  })
})