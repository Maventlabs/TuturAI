import { readFileSync } from 'node:fs'
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

function normalizePem(value) {
  const trimmed = value.trim()
  const unquoted = /^(['"])[\s\S]*\1$/.test(trimmed) ? trimmed.slice(1, -1) : trimmed
  return unquoted.replace(/\\n/g, '\n').trim()
}

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: normalizePem(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
  }),
})
const auth = getAuth(app)
const cookie = readFileSync(new URL('./cookie.txt', import.meta.url), 'utf8').trim()

try {
  const decoded = await auth.verifySessionCookie(cookie, true)
  console.log(JSON.stringify({ ok: true, uid: decoded.uid }))
} catch (error) {
  console.log(JSON.stringify({ ok: false, code: error.code, message: error.message }))
}
