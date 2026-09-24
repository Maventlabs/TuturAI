import { cookies } from 'next/headers'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'

export const SESSION_COOKIE = 'tuturai_session'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5
const SESSION_MAX_AGE_MILLISECONDS = SESSION_MAX_AGE_SECONDS * 1000
const EMULATOR_SESSION_PREFIX = 'emulator.'

function usesAuthEmulator() {
  return process.env.NODE_ENV !== 'production' && Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST)
}

export interface FirebaseSessionUser {
  uid: string
  email: string | null
  displayName: string | null
}

export interface FirebaseProfile {
  id: string
  role: 'student' | 'teacher'
  full_name: string | null
  email: string | null
  school: string | null
  class: string | null
  nip: string | null
  subject: string | null
  xp: number
  level: number
  streak?: number
}

function profileFromDocument(id: string, data: FirebaseFirestore.DocumentData | undefined): FirebaseProfile | null {
  if (!data || (data.role !== 'student' && data.role !== 'teacher')) return null

  return {
    id,
    role: data.role,
    full_name: typeof data.displayName === 'string' ? data.displayName : null,
    email: typeof data.email === 'string' ? data.email : null,
    school: typeof data.school === 'string' ? data.school : null,
    class: typeof data.className === 'string' ? data.className : null,
    nip: typeof data.nip === 'string' ? data.nip : null,
    subject: typeof data.subject === 'string' ? data.subject : null,
    xp: typeof data.xp === 'number' ? data.xp : 0,
    level: typeof data.level === 'number' ? data.level : 1,
    streak: typeof data.streak === 'number' ? data.streak : 0,
  }
}

export async function verifyIdToken(idToken: string) {
  if (!idToken.trim()) throw new Error('ID token is required')
  return getAdminAuth().verifyIdToken(idToken, true)
}

export async function createSessionCookie(idToken: string) {
  if (!idToken.trim()) throw new Error('ID token is required')
  if (usesAuthEmulator()) {
    await getAdminAuth().verifyIdToken(idToken)
    return `${EMULATOR_SESSION_PREFIX}${idToken}`
  }
  return getAdminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MILLISECONDS,
  })
}

export async function verifySessionCookie(sessionCookie: string) {
  if (!sessionCookie.trim()) throw new Error('Session cookie is required')
  if (sessionCookie.startsWith(EMULATOR_SESSION_PREFIX)) {
    return getAdminAuth().verifyIdToken(sessionCookie.slice(EMULATOR_SESSION_PREFIX.length))
  }
  return getAdminAuth().verifySessionCookie(sessionCookie, true)
}

export async function getSessionProfile() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return { user: null, profile: null as FirebaseProfile | null, isDemo: false }

  try {
    const decoded = await verifySessionCookie(token)
    const snapshot = await getAdminDb().collection('users').doc(decoded.uid).get()
    const profile = profileFromDocument(decoded.uid, snapshot.data())
    return {
      user: {
        uid: decoded.uid,
        email: decoded.email ?? null,
        displayName: decoded.name ?? null,
      } satisfies FirebaseSessionUser,
      profile,
      isDemo: false,
    }
  } catch {
    return { user: null, profile: null as FirebaseProfile | null, isDemo: false }
  }
}

export function initialsOf(name: string | null | undefined, fallback = 'TT') {
  if (!name) return fallback
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
