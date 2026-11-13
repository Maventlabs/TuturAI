import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

function normalizePem(value) {
  const trimmed = value.trim()
  const unquoted = /^(['"])[\s\S]*\1$/.test(trimmed) ? trimmed.slice(1, -1) : trimmed
  return unquoted.replace(/\\n/g, '\n').trim()
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
const privateKey = normalizePem(process.env.FIREBASE_ADMIN_PRIVATE_KEY)
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY

const app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
const auth = getAuth(app)
const db = getFirestore(app)

const UID = 'e2e-device-monitor-teacher'
const EMAIL = 'e2e.device.monitor@tuturai.test'

try {
  await auth.getUser(UID)
} catch {
  await auth.createUser({ uid: UID, email: EMAIL, emailVerified: true })
}
await db.collection('users').doc(UID).set(
  { role: 'teacher', displayName: 'E2E Monitor', email: EMAIL, xp: 0, level: 1, streak: 0 },
  { merge: true },
)

const existing = await db.collection('devices').where('ownerTeacherId', '==', UID).get()
await Promise.all(existing.docs.map((doc) => doc.ref.delete()))

const customToken = await auth.createCustomToken(UID)
const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ token: customToken, returnSecureToken: true }),
})
const payload = await response.json()
if (!payload.idToken) throw new Error(`Custom token exchange failed: ${JSON.stringify(payload)}`)
const cookie = await auth.createSessionCookie(payload.idToken, { expiresIn: 60 * 60 * 1000 })

const { writeFileSync } = await import('node:fs')
writeFileSync(new URL('./cookie.txt', import.meta.url), cookie)
console.log(JSON.stringify({ ok: true, cleared: existing.size, cookieLength: cookie.length }))
