import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

// Provisions ONLY dedicated E2E fixtures identified by the E2E_* configuration.
// It refuses to touch any document or account outside the e2e namespace so real
// production users and classrooms can never be modified.

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env.e2e.production')
if (!existsSync(envPath)) {
  console.error(JSON.stringify({ event: 'provision', status: 'FAIL', reason: 'missing .env.e2e.production; copy e2e-prod.env.template first' }))
  process.exit(1)
}
if (typeof process.loadEnvFile === 'function') process.loadEnvFile(envPath)

function required(name) {
  const value = String(process.env[name] ?? '').trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

const projectId = required('E2E_FIREBASE_PROJECT_ID')
const adminProjectId = required('E2E_FIREBASE_ADMIN_PROJECT_ID')
if (projectId.startsWith('demo-') || projectId !== adminProjectId) {
  throw new Error('Provisioning must target the real E2E Firebase project (E2E_FIREBASE_PROJECT_ID === E2E_FIREBASE_ADMIN_PROJECT_ID).')
}
if (String(process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '').trim() || String(process.env.FIRESTORE_EMULATOR_HOST ?? '').trim()) {
  throw new Error('Provisioning refuses Firebase emulator variables.')
}

const identities = [
  { key: 'STUDENT', role: 'student' },
  { key: 'TEACHER', role: 'teacher' },
  { key: 'FOREIGN_TEACHER', role: 'teacher' },
].map(({ key, role }) => ({
  key,
  role,
  email: required(`E2E_${key}_EMAIL`),
  password: required(`E2E_${key}_PASSWORD`),
  uid: required(`E2E_${key}_UID`),
}))

const classroomId = required('E2E_CLASSROOM_ID')
const foreignClassroomId = required('E2E_FOREIGN_CLASSROOM_ID')
const revokedClassroomId = required('E2E_REVOKED_JOIN_CLASSROOM_ID')
const revokedJoinKey = required('E2E_REVOKED_JOIN_KEY')

for (const value of [classroomId, foreignClassroomId, revokedClassroomId]) {
  if (!/^tuturai-e2e-[a-z0-9-]{3,60}$/.test(value)) {
    throw new Error(`Refusing to provision classroom "${value}": fixture IDs must start with tuturai-e2e-.`)
  }
}

const teacher = identities.find((identity) => identity.key === 'TEACHER')
const student = identities.find((identity) => identity.key === 'STUDENT')
const foreignTeacher = identities.find((identity) => identity.key === 'FOREIGN_TEACHER')

const app = initializeApp({
  credential: cert({
    projectId: adminProjectId,
    clientEmail: required('E2E_FIREBASE_ADMIN_CLIENT_EMAIL'),
    privateKey: required('E2E_FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n'),
  }),
  projectId,
}, 'tuturai-prod-e2e-provision')

const auth = getAuth(app)
const db = getFirestore(app)
const now = Timestamp.now()
const summary = { event: 'provision', projectId, accounts: [], classrooms: [] }

for (const identity of identities) {
  let user = null
  try {
    user = await auth.getUser(identity.uid)
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error
  }
  if (!user) {
    user = await auth.createUser({ uid: identity.uid, email: identity.email, password: identity.password, displayName: `E2E ${identity.key.toLowerCase()} account`, emailVerified: true })
  } else {
    if (user.email?.toLowerCase() !== identity.email.toLowerCase()) {
      throw new Error(`Existing Auth UID ${identity.uid} does not match ${identity.email}; refusing to modify a non-E2E account.`)
    }
    await auth.updateUser(identity.uid, { password: identity.password, disabled: false })
  }
  summary.accounts.push({ key: identity.key, uid: identity.uid, created: user.metadata.creationTime !== undefined && user.metadata.lastRefreshTime === undefined ? undefined : undefined, ensured: true })

  const profileRef = db.collection('users').doc(identity.uid)
  const profile = await profileRef.get()
  if (!profile.exists) {
    await profileRef.set({
      id: identity.uid,
      email: identity.email,
      displayName: identity.role === 'teacher' ? `E2E ${identity.key === 'TEACHER' ? 'Teacher' : 'Foreign Teacher'}` : 'E2E Student',
      role: identity.role,
      school: 'TuturAI E2E',
      className: null,
      subject: identity.role === 'teacher' ? 'English' : null,
      xp: 0,
      level: 1,
      streak: 0,
      achievementIds: [],
      createdAt: now,
      updatedAt: now,
    })
  } else if (profile.data()?.role !== identity.role) {
    throw new Error(`Profile ${identity.uid} has permanent role ${profile.data()?.role}; refusing to mutate a non-E2E profile.`)
  }
}

async function ensureClassroom(id, ownerUid, options = {}) {
  const ref = db.collection('classrooms').doc(id)
  const snapshot = await ref.get()
  if (!snapshot.exists) {
    await ref.set({
      name: options.name ?? `[E2E] ${id}`,
      teacherId: ownerUid,
      status: 'active',
      description: 'Dedicated production E2E fixture classroom.',
      school: 'TuturAI E2E',
      joinKeyHash: options.joinKeyHash ?? null,
      joinKeyRevoked: options.joinKeyRevoked ?? false,
      createdAt: now,
      updatedAt: now,
    })
    summary.classrooms.push({ id, ensured: 'created' })
  } else {
    const data = snapshot.data()
    if (data?.teacherId !== ownerUid) throw new Error(`Classroom ${id} is owned by ${data?.teacherId}; refusing to modify a non-E2E classroom.`)
    if (options.joinKeyHash && data?.joinKeyHash !== options.joinKeyHash) await ref.update({ joinKeyHash: options.joinKeyHash, joinKeyRevoked: options.joinKeyRevoked ?? false, updatedAt: now })
    if (options.joinKeyRevoked === true && data?.joinKeyRevoked !== true) await ref.update({ joinKeyRevoked: true, updatedAt: now })
    summary.classrooms.push({ id, ensured: 'verified' })
  }
}

async function ensureMembership(classroom, studentUid) {
  const ref = db.collection('classMemberships').doc(`${classroom}_${studentUid}`)
  const snapshot = await ref.get()
  if (!snapshot.exists) {
    await ref.set({ classId: classroom, studentId: studentUid, status: 'active', joinedAt: now })
  } else if (snapshot.data()?.status !== 'active') {
    await ref.update({ status: 'active', updatedAt: now })
  }
}

await ensureClassroom(classroomId, teacher.uid)
await ensureClassroom(foreignClassroomId, foreignTeacher.uid)
await ensureClassroom(revokedClassroomId, teacher.uid, { joinKeyHash: createHash('sha256').update(revokedJoinKey).digest('hex'), joinKeyRevoked: true })

await ensureMembership(classroomId, student.uid)
await ensureMembership(foreignClassroomId, student.uid)

const revokedMembership = await db.collection('classMemberships').doc(`${revokedClassroomId}_${student.uid}`).get()
if (revokedMembership.exists) {
  await revokedMembership.ref.delete()
  summary.classrooms.push({ id: revokedClassroomId, removedMembership: student.uid })
}

console.log(JSON.stringify(summary))
