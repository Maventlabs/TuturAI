import { readFileSync } from 'node:fs'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

function loadEnv() {
  for (const file of ['../.env.local', '/vercel/share/.env.project']) {
    try {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8')
      for (const line of source.split(/\r?\n/)) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
        if (!match || process.env[match[1]]) continue
        process.env[match[1]] = match[2].replace(/^(['"])|(['"])$/g, '').replace(/\\n/g, '\n')
      }
    } catch {
      // Optional file.
    }
  }
}

loadEnv()

// This script writes to the live Firebase project, so it only runs when the
// caller opts in explicitly.
if (process.env.ALLOW_REMOTE_SEED !== '1') {
  throw new Error('Refusing to write to the live Firebase project. Re-run with ALLOW_REMOTE_SEED=1.')
}

function normalizePem(value) {
  let current = value.trim()
  // The env file can carry the PEM wrapped in more than one layer of quotes.
  while (/^(['"])[\s\S]*\1$/.test(current)) current = current.slice(1, -1).trim()
  return current.replace(/\\n/g, '\n').trim()
}

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: normalizePem(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
    }),
  })

const auth = getAuth(app)
const db = getFirestore(app)

const student = {
  email: process.env.STUDENT_EMAIL ?? 'siswa@tuturai.id',
  password: process.env.STUDENT_PASSWORD ?? 'SiswaTutur2026!',
  displayName: 'Nadia Putri',
  className: 'XI Bahasa 2',
  school: 'SMA Negeri 3 Bandung',
  xp: 1840,
  level: 7,
  streak: 12,
}

let user
try {
  user = await auth.getUserByEmail(student.email)
  await auth.updateUser(user.uid, {
    password: student.password,
    displayName: student.displayName,
    emailVerified: true,
  })
} catch (error) {
  if (error?.code !== 'auth/user-not-found') throw error
  user = await auth.createUser({
    email: student.email,
    password: student.password,
    displayName: student.displayName,
    emailVerified: true,
  })
}

const now = Timestamp.now()
await db.collection('users').doc(user.uid).set(
  {
    id: user.uid,
    email: student.email,
    displayName: student.displayName,
    role: 'student',
    school: student.school,
    className: student.className,
    subject: null,
    xp: student.xp,
    level: student.level,
    streak: student.streak,
    createdAt: now,
    updatedAt: now,
  },
  { merge: true },
)

const teacher = {
  email: process.env.TEACHER_EMAIL ?? 'guru@tuturai.id',
  password: process.env.TEACHER_PASSWORD ?? 'GuruTutur2026!',
  displayName: 'Rani Kusuma',
}

let teacherUser
try {
  teacherUser = await auth.getUserByEmail(teacher.email)
  await auth.updateUser(teacherUser.uid, {
    password: teacher.password,
    displayName: teacher.displayName,
    emailVerified: true,
  })
} catch (error) {
  if (error?.code !== 'auth/user-not-found') throw error
  teacherUser = await auth.createUser({
    email: teacher.email,
    password: teacher.password,
    displayName: teacher.displayName,
    emailVerified: true,
  })
}

await db.collection('users').doc(teacherUser.uid).set(
  {
    id: teacherUser.uid,
    email: teacher.email,
    displayName: teacher.displayName,
    role: 'teacher',
    school: student.school,
    className: null,
    subject: 'English',
    xp: 0,
    level: 1,
    createdAt: now,
    updatedAt: now,
  },
  { merge: true },
)

const classroomId = 'class-xi-bahasa-2'
await db.collection('classrooms').doc(classroomId).set(
  {
    name: 'XI Bahasa 2',
    description: 'Kelas speaking mingguan dengan latihan percakapan dan pronunciation.',
    school: student.school,
    teacherId: teacherUser.uid,
    status: 'active',
    joinKeyHash: 'seeded-classroom',
    joinKeyRevoked: false,
    createdAt: now,
    updatedAt: now,
  },
  { merge: true },
)

await db.collection('classMemberships').doc(`${classroomId}_${user.uid}`).set(
  {
    classId: classroomId,
    studentId: user.uid,
    status: 'active',
    joinedAt: now,
  },
  { merge: true },
)

const assignments = [
  ['tugas-speaking-weekly', 'Speaking check-in mingguan', 'Rekam ringkasan satu menit tentang kegiatanmu minggu ini.', 2, 3],
  ['tugas-grammar-tenses', 'Grammar checkpoint: past tense', 'Kerjakan 10 soal past tense lalu tinjau pembahasannya.', 3, 5],
  ['tugas-percakapan-stasiun', 'Role-play: di stasiun kereta', 'Latih percakapan sopan saat membeli tiket kereta.', 2, 7],
]

for (const [id, title, instructions, maxAttempts, daysAhead] of assignments) {
  await db.collection('assignments').doc(id).set(
    {
      classId: classroomId,
      title,
      instructions,
      status: 'published',
      maxAttempts,
      dueAt: Timestamp.fromMillis(now.toMillis() + daysAhead * 24 * 60 * 60 * 1000),
      attachments: [],
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  )
}

console.log(`[v0] student ready: ${student.email} (uid ${user.uid})`)
console.log(`[v0] teacher ready: ${teacher.email} (uid ${teacherUser.uid})`)
console.log(`[v0] classroom ready: ${classroomId} with ${assignments.length} assignments`)
