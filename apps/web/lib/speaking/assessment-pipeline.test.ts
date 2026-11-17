import { describe, expect, it, vi } from 'vitest'
import { SPEAKING_SCENARIOS, type Assessment } from '@tuturai/domain'
import { encodeWavPcm16 } from '../audio/wav'
import type { SpeakingAnalysis } from '../ai/speaking-analysis-provider'
import {
  runSpeakingAssessment,
  type SpeakingAttempt,
  type SpeakingPipelineDeps,
} from './assessment-pipeline'

const RATE = 16_000
const SCENARIO = SPEAKING_SCENARIOS[0]

function voicedBurst(seconds: number, f0: number) {
  const length = Math.round(seconds * RATE)
  const samples = new Float32Array(length)
  const attack = Math.round(0.02 * RATE)
  for (let index = 0; index < length; index += 1) {
    const envelope = Math.min(1, index / attack, (length - index) / attack)
    const time = index / RATE
    const tone =
      Math.sin(2 * Math.PI * f0 * time)
      + 0.5 * Math.sin(2 * Math.PI * f0 * 2 * time)
      + 0.25 * Math.sin(2 * Math.PI * f0 * 3 * time)
    samples[index] = 0.22 * envelope * tone
  }
  return samples
}

function noiseFloor(seconds: number, amplitude = 0.0015) {
  const length = Math.round(seconds * RATE)
  const samples = new Float32Array(length)
  for (let index = 0; index < length; index += 1) {
    samples[index] = amplitude * (Math.random() * 2 - 1)
  }
  return samples
}

function concat(parts: Float32Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const output = new Float32Array(total)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

/** Six voiced bursts separated by short pauses: ~5.4s of speech, clean signal. */
function speechWav() {
  const parts: Float32Array[] = []
  for (let index = 0; index < 6; index += 1) {
    parts.push(voicedBurst(0.9, 150 + index * 12))
    parts.push(noiseFloor(0.3))
  }
  return encodeWavPcm16(concat(parts), RATE)
}

function noisyWav() {
  return encodeWavPcm16(noiseFloor(6, 0.25), RATE)
}

const TRANSCRIPT =
  'I would like to travel to Japan next spring because I have always been interested in the food and the old temples. ' +
  'I would save money every month, learn some basic phrases, and plan a route that includes both Tokyo and Kyoto.'

function analysis(): SpeakingAnalysis {
  return {
    transcript: TRANSCRIPT,
    grammarFindings: [
      { category: 'article', severity: 'light', original: 'old temples', corrected: 'the old temples' },
    ],
    corrections: [
      { original: 'I would like to travel', corrected: 'I would like to travel', explanation: 'Correct as spoken.' },
    ],
    vocabulary: { notes: 'Good range of everyday words.', suggestions: ['itinerary'], repeatedWords: [] },
    relevance: { onTask: true, comment: 'The answer addresses the task directly.' },
    coherence: { comment: 'Ideas are ordered clearly.' },
    strengths: ['Clear structure with a reason and a plan.'],
    improvements: ['Add one concrete detail about the destination.'],
    dimensionFeedback: {
      pronunciation: 'Pronunciation needs a phoneme alignment provider.',
      fluency: 'Steady pace with few long pauses.',
      intonation: 'Pitch moves with meaning.',
      grammar: 'Only one small article issue.',
      vocabulary: 'Everyday vocabulary used accurately.',
    },
    confidence: 0.92,
    droppedFindings: 0,
  }
}

/** Forty target phonemes with four substitutions: a low, realistic error rate. */
function alignmentEvidence() {
  const targets = ['æ', 'i', 't', 's']
  const words = Array.from({ length: 10 }, (_, wordIndex) => ({
    phonemes: targets.map((expected, phonemeIndex) => {
      const index = wordIndex * targets.length + phonemeIndex
      return { expected, actual: index % 10 === 0 ? 'd' : expected, confidence: 0.9 }
    }),
  }))
  return { words }
}

function deps(overrides: Partial<SpeakingPipelineDeps> = {}) {
  const saveAttempt = vi.fn(async (attempt: SpeakingAttempt) => attempt)
  const saveAssessment = vi.fn(async (assessment: Assessment) => assessment)
  const base: SpeakingPipelineDeps = {
    transcribe: async () => ({ text: TRANSCRIPT, confidence: 0.92, modelId: 'stt-test' }),
    analyzeLanguage: async () => analysis(),
    saveAttempt,
    saveAssessment,
    now: () => new Date('2026-03-01T10:00:00.000Z'),
    ...overrides,
  }
  return { deps: base, saveAttempt, saveAssessment }
}

function input(bytes: Uint8Array) {
  return {
    studentId: 'student-1',
    sessionId: 'session-1',
    scenario: SCENARIO,
    practiceMode: 'guided' as const,
    sessionType: 'quick' as const,
    audio: { bytes, mimeType: 'audio/wav', filename: 'answer.wav' },
  }
}

describe('runSpeakingAssessment', () => {
  it('scores every dimension it can measure and persists the canonical assessment', async () => {
    const { deps: pipelineDeps, saveAssessment } = deps()
    const attempt = await runSpeakingAssessment(input(speechWav()), pipelineDeps)

    expect(attempt.status).toBe('INCOMPLETE')
    expect(attempt.qualityGate.accepted).toBe(true)
    expect(attempt.transcript).toBe(TRANSCRIPT)
    expect(attempt.wordCount).toBeGreaterThan(30)
    expect(attempt.scores.fluency).not.toBeNull()
    expect(attempt.scores.grammar).not.toBeNull()
    expect(attempt.scores.vocabulary).not.toBeNull()
    expect(attempt.scores.intonation).not.toBeNull()
    // No alignment provider is configured, so pronunciation stays unmeasured
    // and the weighted final score is withheld rather than guessed.
    expect(attempt.scores.pronunciation).toBeNull()
    expect(attempt.metricStatuses.pronunciation).toBe('insufficient_evidence')
    expect(attempt.scores.final).toBeNull()
    expect(saveAssessment).not.toHaveBeenCalled()
    expect(attempt.acoustic.snrDb).toBeGreaterThan(10)
    expect(attempt.acoustic.wpm).not.toBeNull()
  })

  it('completes the score when a pronunciation provider supplies alignment evidence', async () => {
    const { deps: pipelineDeps, saveAssessment } = deps({
      alignPronunciation: async () => ({ modelId: 'align-test', evidence: alignmentEvidence() }),
    })

    const attempt = await runSpeakingAssessment(input(speechWav()), pipelineDeps)

    expect(attempt.status).toBe('COMPLETED')
    expect(attempt.scores.pronunciation).not.toBeNull()
    expect(attempt.scores.final).not.toBeNull()
    expect(attempt.provider.pronunciationModelId).toBe('align-test')
    expect(saveAssessment).toHaveBeenCalledTimes(1)
    expect(attempt.assessmentId).toBe(attempt.id)
  })

  it('asks for another take instead of scoring a noisy recording', async () => {
    const { deps: pipelineDeps, saveAssessment } = deps()
    const attempt = await runSpeakingAssessment(input(noisyWav()), pipelineDeps)

    expect(attempt.status).toBe('RETRY_REQUIRED')
    expect(attempt.failure?.code).toBe('RETRY_AUDIO_TOO_NOISY')
    expect(attempt.failure?.retryable).toBe(true)
    expect(attempt.scores.final).toBeNull()
    expect(attempt.scores.fluency).toBeNull()
    expect(saveAssessment).not.toHaveBeenCalled()
  })

  it('reports a transcription failure without inventing a score', async () => {
    const { deps: pipelineDeps } = deps({
      transcribe: async () => {
        throw { code: 'STT_UNAVAILABLE', message: 'Speech recognition is unavailable.', retryable: true }
      },
    })
    const attempt = await runSpeakingAssessment(input(speechWav()), pipelineDeps)

    expect(attempt.status).toBe('FAILED')
    expect(attempt.failure).toMatchObject({ code: 'STT_UNAVAILABLE', retryable: true })
    expect(attempt.scores.final).toBeNull()
  })

  it('rejects audio that is not a decodable WAV', async () => {
    const { deps: pipelineDeps } = deps()
    const attempt = await runSpeakingAssessment(input(new Uint8Array([1, 2, 3, 4])), pipelineDeps)

    expect(attempt.status).toBe('FAILED')
    expect(attempt.failure?.code).toBe('INVALID_AUDIO')
  })
})
