import { getAdminDb } from '@/lib/firebase/admin'
import type { SpeakingAttempt, SpeakingAttemptStatus } from './assessment-pipeline'

/**
 * Speaking Practice session log.
 *
 * `assessments` stays the canonical result collection that XP, teacher
 * analytics, and the adaptive engine already read. This collection records the
 * session itself — status, quality gate, acoustic evidence, and the structured
 * language analysis — including attempts that never produced a valid score, so a
 * retry-required session is never mistaken for a completed assessment.
 */
const COLLECTION = 'speakingAttempts'
const HISTORY_LIMIT = 50

export interface SpeakingHistoryEntry {
  sessionId: string
  scenarioId: string
  scenarioTitle: string
  practiceMode: SpeakingAttempt['practiceMode']
  sessionType: SpeakingAttempt['sessionType']
  status: SpeakingAttemptStatus
  createdAt: string
  durationMs: number
  final: number | null
  failureCode: string | null
}

export interface SpeakingProgressSummary {
  totalSessions: number
  completedSessions: number
  retrySessions: number
  averageFinal: number | null
  bestFinal: number | null
  lastFinal: number | null
  /** Final scores of the most recent completed sessions, newest first. */
  recentFinals: number[]
}

export async function saveSpeakingAttempt(attempt: SpeakingAttempt): Promise<SpeakingAttempt> {
  const reference = getAdminDb().collection(COLLECTION).doc(attempt.id)
  const existing = await reference.get()
  if (existing.exists) return existing.data() as SpeakingAttempt
  await reference.create(attempt)
  return attempt
}

export async function getSpeakingAttempt(studentId: string, sessionId: string): Promise<SpeakingAttempt | null> {
  const snapshot = await getAdminDb().collection(COLLECTION).doc(`${studentId}_${sessionId}`).get()
  if (!snapshot.exists) return null
  const attempt = snapshot.data() as SpeakingAttempt
  return attempt.studentId === studentId ? attempt : null
}

export async function listSpeakingAttempts(studentId: string, limit = HISTORY_LIMIT): Promise<SpeakingAttempt[]> {
  const snapshot = await getAdminDb()
    .collection(COLLECTION)
    .where('studentId', '==', studentId)
    .limit(HISTORY_LIMIT)
    .get()
  return snapshot.docs
    .map((doc) => doc.data() as SpeakingAttempt)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit)
}

export function toHistoryEntry(attempt: SpeakingAttempt): SpeakingHistoryEntry {
  return {
    sessionId: attempt.sessionId,
    scenarioId: attempt.scenarioId,
    scenarioTitle: attempt.scenarioTitle,
    practiceMode: attempt.practiceMode,
    sessionType: attempt.sessionType,
    status: attempt.status,
    createdAt: attempt.createdAt,
    durationMs: attempt.durationMs,
    final: attempt.scores.final,
    failureCode: attempt.failure?.code ?? null,
  }
}

export function summarizeSpeakingHistory(attempts: readonly SpeakingAttempt[]): SpeakingProgressSummary {
  const completed = attempts.filter((attempt) => attempt.scores.final !== null)
  const finals = completed.map((attempt) => attempt.scores.final as number)
  const retry = attempts.filter((attempt) => attempt.status === 'RETRY_REQUIRED' || attempt.status === 'FAILED')
  return {
    totalSessions: attempts.length,
    completedSessions: completed.length,
    retrySessions: retry.length,
    averageFinal: finals.length > 0 ? Math.round(finals.reduce((total, value) => total + value, 0) / finals.length) : null,
    bestFinal: finals.length > 0 ? Math.max(...finals) : null,
    lastFinal: finals.length > 0 ? finals[0] : null,
    recentFinals: finals.slice(0, 8),
  }
}
