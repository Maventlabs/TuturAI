import { describe, expect, it, vi } from 'vitest'
import type { Assessment, NormalizedAssessment } from '@tuturai/domain'
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
})
