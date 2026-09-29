/**
 * SCORING-015 — Canonical scoring persistence read-back.
 *
 * Runs only against the local Firestore emulator. When the emulator is not
 * running, the durable tests skip dynamically (`ctx.skip()`) and a sentinel
 * test reports the skip reason honestly instead of pretending to pass.
 *
 * Init starts at module scope (NOT in `beforeAll`): vitest evaluates
 * `describe.skipIf` during collection, BEFORE hooks run, so hook-based
 * detection made the durable branch permanently skip. The tsconfig here does
 * not allow top-level await, so the probe/init is a fire-and-await promise.
 *
 * firebase-admin parses `cert()` private keys eagerly, so a stub string always
 * throws; the emulator path generates a throwaway RSA keypair at runtime — a
 * test fixture, never a secret.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { generateKeyPairSync } from 'node:crypto'
import { calculateWeightedFinalScore } from '@tuturai/domain'
import type { Assessment } from '@tuturai/domain'
import { readAssessment, saveAssessment } from './scoring-persistence'

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
const PROJECT_ID = 'demo-tuturai'
const ASSESSMENT_ID = 'scoring-e2e_student-1_canonical-session'

function emulatorServiceAccount() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const pemPrivate = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().trim()
  const pemPublic = publicKey.export({ type: 'spki', format: 'pem' }).toString().trim()
  return {
    projectId: PROJECT_ID,
    clientEmail: 'test@demo-tuturai.iam.gserviceaccount.com',
    // firebase-admin signs with createSign(privateKeyPem); appending the public
    // PEM keeps the string a valid multi-PEM that still parses as the private key.
    privateKey: `${pemPrivate}\n${pemPublic}`,
  }
}

let app: App | undefined
let db: Firestore | undefined
let emulatorError: string | undefined

const emulatorReady: Promise<boolean> = (async () => {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1_500)
    await fetch(`http://${EMULATOR_HOST}/`, { signal: controller.signal }).catch(() => {
      throw new Error(`emulator unreachable at ${EMULATOR_HOST}`)
    })
    clearTimeout(timeout)
    app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID, credential: cert(emulatorServiceAccount()) })
    db = getFirestore(app)
    db.settings({ host: EMULATOR_HOST, ssl: false })
    return true
  } catch (error) {
    emulatorError = error instanceof Error ? error.message : String(error)
    return false
  }
})()

afterAll(async () => {
  if (await emulatorReady) {
    await db?.collection('assessments').doc(ASSESSMENT_ID).delete().catch(() => undefined)
  }
})

describe('canonical scoring persistence read-back (SCORING-015)', () => {
  it('persists the canonical block and reads back an identical canonical result', async (ctx) => {
    if (!(await emulatorReady)) ctx.skip()
    const scores = { pronunciation: 80, fluency: 63, intonation: 82, grammar: 85, vocabulary: 88 }
    const final = calculateWeightedFinalScore(scores)
    const assessment: Assessment = {
      id: ASSESSMENT_ID,
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

    const readBack = await readAssessment(ASSESSMENT_ID)
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

  it('is idempotent: a duplicate save returns the stored canonical record untouched', async (ctx) => {
    if (!(await emulatorReady)) ctx.skip()

    const existing = await readAssessment(ASSESSMENT_ID)
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
  it('skips when the emulator IS running; without it, records the reason honestly', async (ctx) => {
    if (await emulatorReady) ctx.skip()

    console.warn('[scoring-persistence] Firestore emulator unavailable:', emulatorError ?? 'unknown reason')
    expect(typeof emulatorError).toBe('string')
  })
})
