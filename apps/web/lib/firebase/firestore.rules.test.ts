import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Timestamp, collection, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'

const rules = fs.readFileSync(path.resolve(process.cwd(), '../../firestore.rules'), 'utf8')
const classroomPath = 'classrooms/class-1'
const teacherUid = 'teacher-1'
const studentUid = 'student-1'
const outsiderUid = 'student-2'

let testEnv: RulesTestEnvironment

function emulatorConnection() {
  const [host = '127.0.0.1', port = '8080'] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':')
  return { host, port: Number(port) }
}

function profile(uid: string, role: 'student' | 'teacher') {
  const timestamp = Timestamp.fromMillis(1_700_000_000_000)
  return {
    id: uid,
    email: `${uid}@example.com`,
    displayName: uid,
    school: 'SMA 1',
    role,
    className: role === 'student' ? 'XI IPA 2' : null,
    subject: role === 'teacher' ? 'English' : null,
    xp: 0,
    level: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function classroom() {
  const timestamp = Timestamp.fromMillis(1_700_000_000_000)
  return {
    name: 'English XI IPA',
    description: 'Speaking practice',
    school: 'SMA 1',
    teacherId: teacherUid,
    status: 'active',
    joinKeyHash: 'a'.repeat(64),
    joinKeyRevoked: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await Promise.all([
      setDoc(doc(db, 'users', teacherUid), profile(teacherUid, 'teacher')),
      setDoc(doc(db, 'users', studentUid), profile(studentUid, 'student')),
      setDoc(doc(db, 'users', outsiderUid), profile(outsiderUid, 'student')),
      setDoc(doc(db, classroomPath), classroom()),
      setDoc(doc(db, 'classMemberships', `${classroomPath.split('/')[1]}_${studentUid}`), {
        classId: 'class-1',
        studentId: studentUid,
        status: 'active',
        joinedAt: Timestamp.fromMillis(1_700_000_000_000),
      }),
    ])
  })
}

describe('Firestore security rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-tuturai',
      firestore: { rules, ...emulatorConnection() },
    })
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()
    await seed()
  })

  afterAll(async () => {
    await testEnv?.cleanup()
  })

  it('allows the classroom owner and active member to read, but denies outsiders', async () => {
    const teacherDb = testEnv.authenticatedContext(teacherUid).firestore()
    const studentDb = testEnv.authenticatedContext(studentUid).firestore()
    const outsiderDb = testEnv.authenticatedContext(outsiderUid).firestore()

    await assertSucceeds(getDoc(doc(teacherDb, classroomPath)))
    await assertSucceeds(getDoc(doc(studentDb, classroomPath)))
    await assertFails(getDoc(doc(outsiderDb, classroomPath)))
  })

  it('keeps user profile PII owner-only', async () => {
    const ownerDb = testEnv.authenticatedContext(studentUid).firestore()
    const outsiderDb = testEnv.authenticatedContext(outsiderUid).firestore()

    await assertSucceeds(getDoc(doc(ownerDb, 'users', studentUid)))
    await assertFails(getDoc(doc(outsiderDb, 'users', studentUid)))
  })

  it('prevents a user from self-assigning the teacher role', async () => {
    const studentDb = testEnv.authenticatedContext(outsiderUid).firestore()
    const teacherProfile = { ...profile(outsiderUid, 'teacher') }

    await assertFails(setDoc(doc(studentDb, 'users', 'new-user'), teacherProfile))
  })

  it('prevents classroom ownership and join-key tampering', async () => {
    const teacherDb = testEnv.authenticatedContext(teacherUid).firestore()

    await assertFails(updateDoc(doc(teacherDb, classroomPath), { teacherId: outsiderUid }))
    await assertFails(updateDoc(doc(teacherDb, classroomPath), { joinKeyHash: 'b'.repeat(64) }))
  })

  it('allows the owner to update metadata without changing protected fields', async () => {
    const teacherDb = testEnv.authenticatedContext(teacherUid).firestore()

    await assertSucceeds(updateDoc(doc(teacherDb, classroomPath), {
      name: 'Updated English XI IPA',
      updatedAt: Timestamp.now(),
    }))
  })

  it('keeps membership writes server-only', async () => {
    const studentDb = testEnv.authenticatedContext(studentUid).firestore()
    const membershipRef = doc(collection(studentDb, 'classMemberships'))

    await assertFails(setDoc(membershipRef, {
      classId: 'class-1',
      studentId: studentUid,
      status: 'active',
      joinedAt: Timestamp.now(),
    }))
  })
})
