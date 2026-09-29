import { describe, expect, it, vi } from 'vitest'
import type { Assessment, AssessmentWithScoreSources, NormalizedAssessment } from '@tuturai/domain'
import type { AssessmentProviderRequest } from './assessment-provider'
import { processAssessment } from './assessment-processing'

const normalized: NormalizedAssessment = {
  pronunciation: 80,
  fluency: 78,
  intonation: 82,
  grammar: 75,
  vocabulary: 88,
  overall: 0,
  transcript: 'I practice every day.',
  feedback: 'Keep working on consistent pacing.',
  confidence: 0.9,
}

describe('processAssessment', () => {
  it('persists a provider-confirmed assessment with a deterministic session identity', async () => {
    const provider = { assess: vi.fn().mockResolvedValue(normalized) }
    const save = vi.fn().mockImplementation(async (assessment: Assessment) => assessment)
    const request: AssessmentProviderRequest = { audio: new Uint8Array([1]), mimeType: 'audio/webm' }

    await expect(
      processAssessment({
        provider,
        save,
        studentId: 'student-1',
        sessionId: 'session-1',
        request,
        now: new Date('2026-09-22T00:00:00.000Z'),
      }),
    ).resolves.toMatchObject({
      id: 'student-1_session-1',
      sessionId: 'session-1',
      studentId: 'student-1',
        overall: 81,
      error: null,
      createdAt: '2026-09-22T00:00:00.000Z',
    })
    expect(save).toHaveBeenCalledOnce()
  })

  it('does not persist an assessment when the provider fails', async () => {
    const provider = { assess: vi.fn().mockRejectedValue(new Error('provider unavailable')) }
    const save = vi.fn()

    await expect(
      processAssessment({
        provider,
        save,
        studentId: 'student-1',
        sessionId: 'session-2',
        request: { audio: new Uint8Array([1]), mimeType: 'audio/webm' },
      }),
    ).rejects.toThrow('provider unavailable')
    expect(save).not.toHaveBeenCalled()
  })

  it('derives the pronunciation overall from the menu-specific formula', async () => {
    const provider = { assess: vi.fn().mockResolvedValue(normalized) }
    const save = vi.fn().mockImplementation(async (assessment: Assessment) => assessment)

    await expect(processAssessment({
      provider,
      save,
      studentId: 'student-1',
      sessionId: 'pronunciation-1',
      mode: 'pronunciation',
      request: { audio: new Uint8Array([1]), mimeType: 'audio/webm', mode: 'pronunciation', expectedText: 'thought' },
    })).resolves.toMatchObject({ mode: 'pronunciation', overall: 81 })
  })

  it('persists the canonical scoring block with version, mode, scores, and provider confidence (SCORING-011)', async () => {
    const provider = { assess: vi.fn().mockResolvedValue(normalized) }
    let saved: Assessment | undefined
    const save = vi.fn().mockImplementation(async (assessment: Assessment) => {
      saved = assessment
      return assessment
    })

    const result = await processAssessment({
      provider,
      save,
      studentId: 'student-1',
      sessionId: 'canonical-1',
      request: { audio: new Uint8Array([1]), mimeType: 'audio/webm' },
    })

    expect(result.scoring).toBeDefined()
    expect(result.scoring?.scoringVersion).toBe('2026.1')
    expect(result.scoring?.mode).toBe('ONLINE_FULL')
    expect(result.scoring?.scores).toEqual({
      pronunciation: 80,
      fluency: 78,
      intonation: 82,
      grammar: 75,
      vocabulary: 88,
      final: 81,
    })
    expect(result.scoring?.rawMetrics).toEqual({ providerConfidence: 0.9 })
    // Engine-owned final must equal the persisted overall so analytics consumers
    // read one consistent canonical number.
    expect(result.scoring?.scores.final).toBe(result.overall)
    expect(saved?.scoring?.scoringVersion).toBe('2026.1')
  })

  it('omits rawMetrics when the provider reports no confidence instead of inventing one', async () => {
    const provider = { assess: vi.fn().mockResolvedValue({ ...normalized, confidence: null }) }
    const save = vi.fn().mockImplementation(async (assessment: Assessment) => assessment)

    const result = await processAssessment({
      provider,
      save,
      studentId: 'student-1',
      sessionId: 'canonical-2',
      request: { audio: new Uint8Array([1]), mimeType: 'audio/webm' },
    })

    expect(result.scoring?.rawMetrics).toBeUndefined()
    expect(result.scoring?.scoringVersion).toBe('2026.1')
  })

  it('recomputes fluency and grammar canonically when structured evidence exists (SCORING-012 wiring)', async () => {
    const provider = { assess: vi.fn().mockResolvedValue(normalized) }
    const save = vi.fn().mockImplementation(async (assessment: Assessment) => assessment)

    const result = await processAssessment({
      provider,
      save,
      studentId: 'student-1',
      sessionId: 'evidence-1',
      request: { audio: new Uint8Array([1]), mimeType: 'audio/webm' },
      audioEvidence: {
        fluency: {
          wordCount: 14,
          spokenDurationMs: 10_000,
          totalPauseDurationMs: 2_500,
          totalRecordingDurationMs: 10_000,
        },
      },
      structuredEvidence: {
        grammar: [
          { category: 'article', severity: 'light' },
          { category: 'subject_verb_agreement', severity: 'medium' },
        ],
      },
    })

    // 84 WPM -> WPMnorm (84-40)/80 = 0.55; pause 0.25 -> 0.6*0.55+0.4*0.75 = 0.63 -> 63
    expect(result.fluency).toBeCloseTo(63)
    // penalties 5+10=15 -> 85
    expect(result.grammar).toBe(85)
    expect(result.overall).toBe(result.scoring?.scores.final)
    expect((result as AssessmentWithScoreSources).scoreSources).toMatchObject({
      fluency: 'CANONICAL_ENGINE',
      grammar: 'CANONICAL_ENGINE',
      pronunciation: 'PROVIDER_ESTIMATE',
    })
    expect(result.scoring?.rawMetrics?.wpm).toBeCloseTo(84)
    expect(result.scoring?.rawMetrics?.pauseRatio).toBeCloseTo(0.25)
    expect(result.scoring?.rawMetrics?.grammarTotalFindings).toBe(2)
  })

  it('keeps provider estimates labeled when no evidence is available, without engine overrides', async () => {
    const provider = { assess: vi.fn().mockResolvedValue(normalized) }
    const save = vi.fn().mockImplementation(async (assessment: Assessment) => assessment)

    const result = await processAssessment({
      provider,
      save,
      studentId: 'student-1',
      sessionId: 'estimate-1',
      request: { audio: new Uint8Array([1]), mimeType: 'audio/webm' },
    })

    expect(result.fluency).toBe(normalized.fluency)
    expect(result.grammar).toBe(normalized.grammar)
    expect((result as AssessmentWithScoreSources).scoreSources).toBeUndefined()
    expect(result.scoring?.scores.fluency).toBe(normalized.fluency)
  })

  it('fails the whole assessment instead of silently dropping malformed grammar findings (SCORING-014)', async () => {
    const provider = { assess: vi.fn().mockResolvedValue(normalized) }
    const save = vi.fn()

    await expect(
      processAssessment({
        provider,
        save,
        studentId: 'student-1',
        sessionId: 'malformed-1',
        request: { audio: new Uint8Array([1]), mimeType: 'audio/webm' },
        structuredEvidence: {
          grammar: [{ category: 'article', severity: 'catastrophic' } as never],
        },
      }),
    ).rejects.toThrowError(/severity/)
    expect(save).not.toHaveBeenCalled()
  })

  it('fails explicitly on impossible audio fluency evidence without persisting (SCORING-014)', async () => {
    const provider = { assess: vi.fn().mockResolvedValue(normalized) }
    const save = vi.fn()

    await expect(
      processAssessment({
        provider,
        save,
        studentId: 'student-1',
        sessionId: 'bad-audio-1',
        request: { audio: new Uint8Array([1]), mimeType: 'audio/webm' },
        audioEvidence: {
          fluency: {
            wordCount: 10,
            spokenDurationMs: 5_000,
            totalPauseDurationMs: 6_000,
            totalRecordingDurationMs: 5_000,
          },
        },
      }),
    ).rejects.toThrowError(/exceeds/)
    expect(save).not.toHaveBeenCalled()
  })
})
