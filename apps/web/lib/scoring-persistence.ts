import { type Assessment } from '@tuturai/domain'
import { invalidateNamespaces } from '@/lib/cache'
import { getAdminDb } from '@/lib/firebase/admin'
import { awardAttemptXp, xpCacheNamespaces } from '@/lib/xp-award'

/**
 * Idempotent canonical assessment persistence shared by the API route and the
 * durable read-back integration test (SCORING-015). Creating an already-existing
 * document returns the stored one so duplicate submissions cannot overwrite the
 * canonical record — and cannot award XP twice.
 */
export async function saveAssessment(assessment: Assessment) {
  const db = getAdminDb()
  const reference = db.collection('assessments').doc(assessment.id)
  const userRef = db.collection('users').doc(assessment.studentId)
  const saved = await db.runTransaction(async (transaction) => {
    const [existing, userSnapshot] = await Promise.all([transaction.get(reference), transaction.get(userRef)])
    if (existing.exists) return existing.data() as Assessment
    transaction.create(reference, assessment)
    awardAttemptXp(transaction, userRef, userSnapshot, assessment.overall)
    return assessment
  })

  await invalidateNamespaces(...xpCacheNamespaces(assessment.studentId))
  return saved
}

/** Durable canonical read-back used by the GET path and integration tests. */
export async function readAssessment(assessmentId: string) {
  const snapshot = await getAdminDb().collection('assessments').doc(assessmentId).get()
  return snapshot.exists ? (snapshot.data() as Assessment) : null
}
