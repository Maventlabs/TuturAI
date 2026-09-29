import { type Assessment } from '@tuturai/domain'
import { getAdminDb } from '@/lib/firebase/admin'

/**
 * Idempotent canonical assessment persistence shared by the API route and the
 * durable read-back integration test (SCORING-015). Creating an already-existing
 * document returns the stored one so duplicate submissions cannot overwrite the
 * canonical record.
 */
export async function saveAssessment(assessment: Assessment) {
  const reference = getAdminDb().collection('assessments').doc(assessment.id)
  return getAdminDb().runTransaction(async (transaction) => {
    const existing = await transaction.get(reference)
    if (existing.exists) return existing.data() as Assessment
    transaction.create(reference, assessment)
    return assessment
  })
}

/** Durable canonical read-back used by the GET path and integration tests. */
export async function readAssessment(assessmentId: string) {
  const snapshot = await getAdminDb().collection('assessments').doc(assessmentId).get()
  return snapshot.exists ? (snapshot.data() as Assessment) : null
}
