import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getFirebaseAdminEnv } from '@/lib/config/env'

function getAdminApp() {
  const existing = getApps()[0]
  if (existing) return existing

  const env = getFirebaseAdminEnv()
  return initializeApp({
    credential: cert({
      projectId: env.projectId,
      clientEmail: env.clientEmail,
      privateKey: env.privateKey,
    }),
  })
}

export function getAdminAuth() {
  return getAuth(getAdminApp())
}

export function getAdminDb() {
  return getFirestore(getAdminApp())
}
