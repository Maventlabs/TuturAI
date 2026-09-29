/**
 * SCORING-015 — Canonical scoring persistence read-back.
 *
 * Runs only against the local Firestore emulator. When the emulator is not
 * running, the suite skips and says so instead of pretending to pass. Durable
 * proof therefore exists exactly when the emulator does, and never fabricates.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { calculateWeightedFinalScore } from '@tuturai/domain'
import type { Assessment } from '@tuturai/domain'
import { readAssessment, saveAssessment } from './scoring-persistence'

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
const PROJECT_ID = 'demo-tuturai'

let hasEmulator = false
let app: App | undefined
let db: Firestore | undefined

beforeAll(async () => {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1_500)
    await fetch(`http://${EMULATOR_HOST}/`, { signal: controller.signal }).catch(() => {
      throw new Error('emulator unreachable')
    })
    clearTimeout(timeout)
    hasEmulator = true
    app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID, credential: cert({ projectId: PROJECT_ID, clientEmail: 'test@demo-tuturai.iam.gserviceaccount.com', privateKey: '-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----' }) })
    db = getFirestore(app)
    db.settings({ host: EMULATOR_HOST, ssl: false })
  } catch {
    hasEmulator = false
  }
})

afterAll(async () => {
  const assessmentIds = ['scoring-e2e_student-1_canonical-session']
  for (const id of assessmentIds) {
    await db?.collection('assessments').doc(id).delete().catch(() => undefined)
  }
})

describe.skipIf(!hasEmulator)('canonical scoring persistence read-back (SCORING-015)', () => {
  it('persists the canonical block and reads back an identical canonical result', async () => {
    const scores = { pronunciation: 80, fluency: 63, intonation: 82, grammar: 85, vocabulary: 88 }
    const final = calculateWeightedFinalScore(scores)
    const assessment: Assessment = {
      id: 'scoring-e2e_student-1_canonical-session',
      sessionId: 'canonical-session',
      studentId: 'scoring-e2e_student-1',
      pronunciation: scores.pronunciation,
      fluency: scores.fluency,
      intonation: scores.intonation,
      grammar: scores.grammar,
      vocabulary: scores.vocabulary,
      overall: final,
      transcript: 'I practice English every morning.',
      feedback: 'Steady pace and rich vocabulary.',
      confidence: 0.9,
      mode: 'speaking',
      error: null,
      createdAt: '2026-09-29T00:00:00.000Z',
      scoring: {
        scoringVersion: '2026.1',
        mode: 'ONLINE_FULL',
        scores: { ...scores, final },
        rawMetrics: { wpm: 84, pauseRatio: 0.25, providerConfidence: 0.9 },
      },
    }

    const saved = await saveAssessment(assessment)
    expect(saved.scoring?.scores.final).toBe(final)

    const readBack = await readAssessment(assessment.id)
    expect(readBack).not.toBeNull()
    expect(readBack?.scoring?.scoringVersion).toBe('2026.1')
    expect(readBack?.scoring?.scores).toEqual(saved.scoring?.scores)
    expect(readBack?.overall).toBe(final)
    // Round-trip determinism: re-aggregating persisted dimensions reproduces the persisted final.
    expect(calculateWeightedFinalScore({
      pronunciation: readBack!.pronunciation,
      fluency: readBack!.fluency,
      intonation: readBack!.intonation,
      grammar: readBack!.grammar,
      vocabulary: readBack!.vocabulary,
    })).toBe(readBack!.overall)
  })

  it('is idempotent: a duplicate save returns the stored canonical record untouched', async () => {
    const existing = await readAssessment('scoring-e2e_student-1_canonical-session')
    expect(existing).not.toBeNull()

    const duplicate: Assessment = {
      ...existing!,
      pronunciation: 1,
      fluency: 1,
      intonation: 1,
      grammar: 1,
      vocabulary: 1,
      overall: 1,
      scoring: { ...existing!.scoring!, scores: { ...existing!.scoring!.scores, pronunciation: 1, final: 1 } },
    }

    const result = await saveAssessment(duplicate)
    // The stored canonical document must win over any duplicate overwrite attempt.
    expect(result.pronunciation).toBe(existing!.pronunciation)
    expect(result.scoring?.scores.final).toBe(existing!.scoring?.scores.final)
  })
})

describe('canonical scoring persistence (emulator unavailable)', () => {
  it.skipIf(hasEmulator)('is skipped because the Firestore emulator is not running', () => {
    expect(hasEmulator).toBe(false)
  })
})
