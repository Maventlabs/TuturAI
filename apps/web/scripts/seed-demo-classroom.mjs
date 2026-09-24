import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

function loadLocalEnv() {
  try {
    const source = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!match || process.env[match[1]]) continue
      process.env[match[1]] = match[2].replace(/^"|"$/g, '').replace(/\\n/g, '\n')
    }
  } catch {
    // CI can provide the emulator variables and admin project id directly.
  }
}

loadLocalEnv()

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Refusing to seed non-emulator Firebase. Set FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST.')
}

const projectId = process.env.FIREBASE_PROJECT_ID ?? 'demo-tuturai'
const app = getApps()[0] ?? initializeApp(
  process.env.FIREBASE_ADMIN_PROJECT_ID
    ? {
        credential: cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
        }),
      }
    : { projectId },
)
const auth = getAuth(app)
const db = getFirestore(app)

const teacher = {
  id: 'demo-teacher-ava',
  email: 'ava.pratama@demo.example.test',
  displayName: 'Ava Pratama',
  password: 'DemoTeacher2026!',
  xp: 0,
  level: 1,
}

const students = [
  ['nina-wijaya', 'Nina Wijaya', 'nina.wijaya@demo.example.test', 'beginner', 240, 3, 'grammar'],
  ['bimo-saputra', 'Bimo Saputra', 'bimo.saputra@demo.example.test', 'beginner', 95, 2, 'pronunciation'],
  ['citra-lestari', 'Citra Lestari', 'citra.lestari@demo.example.test', 'beginner', 410, 4, 'vocabulary'],
  ['dimas-haryono', 'Dimas Haryono', 'dimas.haryono@demo.example.test', 'intermediate', 680, 7, 'fluency'],
  ['elsa-maharani', 'Elsa Maharani', 'elsa.maharani@demo.example.test', 'intermediate', 520, 6, 'intonation'],
  ['farhan-akbar', 'Farhan Akbar', 'farhan.akbar@demo.example.test', 'intermediate', 860, 9, 'grammar'],
  ['gita-ramadhani', 'Gita Ramadhani', 'gita.ramadhani@demo.example.test', 'intermediate', 735, 8, 'vocabulary'],
  ['hadi-kurniawan', 'Hadi Kurniawan', 'hadi.kurniawan@demo.example.test', 'advanced', 1240, 13, 'fluency'],
  ['intan-permata', 'Intan Permata', 'intan.permata@demo.example.test', 'advanced', 1460, 15, 'pronunciation'],
  ['joko-pranoto', 'Joko Pranoto', 'joko.pranoto@demo.example.test', 'advanced', 1010, 11, 'intonation'],
].map(([slug, displayName, email, level, xp, levelNumber, focus]) => ({ id: `demo-student-${slug}`, slug, displayName, email, level, xp, levelNumber, focus, password: 'DemoStudent2026!' }))

const classroomId = 'demo-classroom-english-01'
const assignmentIds = ['demo-assignment-speaking', 'demo-assignment-grammar', 'demo-assignment-conversation']
const now = Timestamp.now()
const joinKey = 'TUTUR-DEMO-2026'
const joinKeyHash = createHash('sha256').update(joinKey).digest('hex')

async function upsertAuthUser(user) {
  try {
    await auth.getUser(user.id)
    await auth.updateUser(user.id, { email: user.email, password: user.password, displayName: user.displayName })
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error
    await auth.createUser({ uid: user.id, email: user.email, password: user.password, displayName: user.displayName })
  }
}

await upsertAuthUser(teacher)
await Promise.all(students.map(upsertAuthUser))

const batch = db.batch()
const userRef = db.collection('users')
batch.set(userRef.doc(teacher.id), {
  id: teacher.id,
  email: teacher.email,
  displayName: teacher.displayName,
  role: 'teacher',
  school: 'TuturAI Demo School',
  className: null,
  subject: 'English',
  xp: teacher.xp,
  level: teacher.level,
  createdAt: now,
  updatedAt: now,
})

for (const student of students) {
  batch.set(userRef.doc(student.id), {
    id: student.id,
    email: student.email,
    displayName: student.displayName,
    role: 'student',
    school: 'TuturAI Demo School',
    className: 'English Growth Lab',
    subject: null,
    xp: student.xp,
    level: student.levelNumber,
    createdAt: now,
    updatedAt: now,
  })
}

batch.set(db.collection('classrooms').doc(classroomId), {
  name: 'English Growth Lab',
  description: 'Synthetic classroom for dashboard, assignment, and analytics verification.',
  school: 'TuturAI Demo School',
  teacherId: teacher.id,
  status: 'active',
  joinKeyHash,
  joinKeyRevoked: false,
  createdAt: now,
  updatedAt: now,
})

for (const student of students) {
  batch.set(db.collection('classMemberships').doc(`${classroomId}_${student.id}`), {
    classId: classroomId,
    studentId: student.id,
    status: 'active',
    joinedAt: now,
  })
}

const assignments = [
  ['demo-assignment-speaking', 'Weekly speaking check-in', 'Record a one-minute summary of your week.', 2],
  ['demo-assignment-grammar', 'Grammar checkpoint', 'Complete the grammar checkpoint and review feedback.', 3],
  ['demo-assignment-conversation', 'Role-play conversation', 'Practice a polite conversation at a train station.', 2],
]
for (const [id, title, instructions, maxAttempts] of assignments) {
  batch.set(db.collection('assignments').doc(id), {
    classId: classroomId,
    title,
    instructions,
    status: 'published',
    maxAttempts,
    dueAt: null,
    createdAt: now,
    updatedAt: now,
  })
}

for (const [index, student] of students.entries()) {
  const assignmentId = assignmentIds[index % assignmentIds.length]
  const status = index % 5 === 0 ? 'approved' : index % 3 === 0 ? 'returned' : 'pending_review'
  const submissionId = `demo-submission-${student.slug}`
  batch.set(db.collection('submissions').doc(submissionId), {
    assignmentId,
    studentId: student.id,
    attempt: index % 3 === 0 ? 2 : 1,
    status,
    isLate: index % 4 === 0,
    teacherFeedback: status === 'returned' ? 'Slow down and connect the final sounds.' : null,
    submittedAt: now,
    updatedAt: now,
  })
  batch.set(db.collection('assessments').doc(`demo-assessment-${student.slug}`), {
    id: `demo-assessment-${student.slug}`,
    sessionId: `demo-session-${student.slug}`,
    studentId: student.id,
    questionId: assignmentId,
    mode: 'speaking',
    pronunciation: 58 + (index * 3) % 35,
    fluency: 62 + (index * 5) % 30,
    intonation: 60 + (index * 4) % 32,
    grammar: 55 + (index * 6) % 38,
    vocabulary: 64 + (index * 7) % 30,
    overall: 60 + (index * 5) % 32,
    transcript: `Demo speaking response from ${student.displayName}.`,
    feedback: `Focus practice on ${student.focus}.`,
    confidence: 0.8,
    error: null,
    createdAt: now.toDate().toISOString(),
  })
  batch.set(db.collection('questionAttempts').doc(`demo-attempt-${student.slug}`), {
    id: `demo-attempt-${student.slug}`,
    studentId: student.id,
    questionId: `demo-question-${index + 1}`,
    classroomId,
    skill: student.focus,
    isCorrect: index % 4 !== 1,
    createdAt: now,
  })
}

// This is intentionally processing until a real OmniVoice provider confirms enrollment.
batch.set(db.collection('voiceProfiles').doc(teacher.id), {
  teacherId: teacher.id,
  provider: 'omnivoice',
  providerVoiceId: 'demo-pending-provider-voice',
  status: 'processing',
  consentAt: now.toDate().toISOString(),
  errorCode: null,
  createdAt: now,
  updatedAt: now,
})

await batch.commit()
console.log(JSON.stringify({
  ok: true,
  environment: 'firebase-emulator-only',
  classroomId,
  joinKey,
  teacher: { email: teacher.email, password: teacher.password },
  students: students.map(({ displayName, email, password, level, xp, focus }) => ({ displayName, email, password, level, xp, focus })),
  voiceProfileStatus: 'processing',
}, null, 2))
