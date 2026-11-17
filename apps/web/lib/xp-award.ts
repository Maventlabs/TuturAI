import { FieldValue, Timestamp, type DocumentReference, type DocumentSnapshot, type Transaction } from 'firebase-admin/firestore'
import { levelForXp, xpForAttempt } from '@tuturai/domain'

/**
 * Awards the XP a completed attempt is worth and keeps `level` in step.
 *
 * A missing user document is not an error: the attempt itself is still valid
 * evidence, so scoring must not fail because the profile row is absent.
 */
export function awardAttemptXp(
  transaction: Transaction,
  userRef: DocumentReference,
  userSnapshot: DocumentSnapshot,
  score: number,
): number {
  if (!userSnapshot.exists) return 0
  const data = userSnapshot.data() ?? {}
  const currentXp = typeof data.xp === 'number' && Number.isFinite(data.xp) ? data.xp : 0
  const earned = xpForAttempt(score)
  transaction.update(userRef, {
    xp: FieldValue.increment(earned),
    level: levelForXp(currentXp + earned),
    updatedAt: Timestamp.now(),
  })
  return earned
}

/**
 * Every XP write changes the profile, the dashboard aggregates, and the
 * learning stats that read them, so all three caches are dropped together.
 */
export function xpCacheNamespaces(studentId: string) {
  return [`profile:${studentId}`, `analytics:dashboard:${studentId}`, `analytics:learningStats:${studentId}`]
}
