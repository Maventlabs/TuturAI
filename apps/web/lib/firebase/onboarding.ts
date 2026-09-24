import { FieldValue } from 'firebase-admin/firestore'
import type { OnboardingInput } from '@tuturai/validation'
import { getAdminDb } from '@/lib/firebase/admin'

export async function createOrReadProfile(
  uid: string,
  email: string | null,
  input: OnboardingInput,
) {
  const db = getAdminDb()
  const ref = db.collection('users').doc(uid)

  return db.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref)
    if (existing.exists) {
      const data = existing.data()
      if (data?.role !== input.role) {
        throw new Error('ROLE_ALREADY_SET')
      }
      return { id: uid, ...data }
    }

    const profile = {
      id: uid,
      email,
      displayName: input.displayName,
      school: input.school,
      role: input.role,
      className: input.className ?? null,
      subject: input.subject ?? null,
      xp: 0,
      level: 1,
      streak: 0,
      lastActiveDate: null,
      learningAttempts: 0,
      correctAnswers: 0,
      achievementIds: [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }
    transaction.create(ref, profile)
    return profile
  })
}
