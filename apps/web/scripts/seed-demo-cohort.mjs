import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

function loadLocalEnv() {
  for (const file of ['../.env.local', '../.env.development.local']) {
    try {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8')
      for (const line of source.split(/\r?\n/)) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
        if (!match || process.env[match[1]]) continue
        process.env[match[1]] = match[2].replace(/^"|"$/g, '').replace(/\\n/g, '\n')
      }
    } catch {
      // CI can provide the admin variables directly.
    }
  }
}

loadLocalEnv()

// The env file stores the PEM wrapped in one or two layers of quotes, so peel
// them the same way lib/config/env.ts does before handing it to firebase-admin.
function normalizePem(value) {
  let current = String(value ?? '').trim()
  for (let pass = 0; pass < 3; pass += 1) {
    if (!/^(['"])[\s\S]*\1$/.test(current)) break
    current = current.slice(1, -1).trim()
  }
  return current.replace(/\\n/g, '\n').trim()
}

if (process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
  process.env.FIREBASE_ADMIN_PRIVATE_KEY = normalizePem(process.env.FIREBASE_ADMIN_PRIVATE_KEY)
}

const dryRun = process.argv.includes('--dry-run')
const approved = process.env.E2E_TEST_DATA_APPROVED === 'true' || process.env.DEMO_SEED_APPROVED === 'true'

if (!dryRun && !approved) {
  throw new Error('Refusing to write demo data. Set E2E_TEST_DATA_APPROVED=true (or run with --dry-run).')
}

const STUDENTS_PER_CLASS = 40
const STUDENT_PASSWORD = 'DemoSiswa2026!'
const TEACHER_PASSWORD = 'DemoGuru2026!'
const SCHOOL = 'SMP TuturAI Demo'
const EMAIL_DOMAIN = 'demo.tuturai.test'

const teacher = {
  id: 'demo-teacher-01',
  email: `guru.demo@${EMAIL_DOMAIN}`,
  displayName: 'Rani Kusuma',
  password: TEACHER_PASSWORD,
}

const classrooms = [
  {
    id: 'demo-class-01',
    name: 'Kelas 7A · English Foundations',
    description: 'Kelas demo tingkat dasar: fokus kosakata harian dan tata bahasa dasar.',
    joinKey: 'TUTUR-7A-DEMO',
    levelRange: [1, 6],
    accuracyRange: [0.45, 0.72],
  },
  {
    id: 'demo-class-02',
    name: 'Kelas 8B · English Explorers',
    description: 'Kelas demo tingkat menengah: latihan percakapan dan pemahaman bacaan.',
    joinKey: 'TUTUR-8B-DEMO',
    levelRange: [5, 11],
    accuracyRange: [0.6, 0.85],
  },
  {
    id: 'demo-class-03',
    name: 'Kelas 9C · English Achievers',
    description: 'Kelas demo tingkat lanjut: presentasi, diskusi, dan persiapan ujian.',
    joinKey: 'TUTUR-9C-DEMO',
    levelRange: [9, 16],
    accuracyRange: [0.72, 0.95],
  },
]

const assignmentTemplates = [
  ['Rekaman speaking mingguan', 'Rekam ringkasan satu menit tentang kegiatanmu minggu ini.', 2],
  ['Grammar checkpoint: past tense', 'Kerjakan checkpoint tata bahasa dan tinjau umpan baliknya.', 3],
  ['Role-play: di stasiun kereta', 'Praktikkan percakapan sopan saat membeli tiket kereta.', 2],
]

const firstNames = [
  'Aisyah', 'Bagas', 'Citra', 'Dimas', 'Elsa', 'Farhan', 'Gita', 'Hadi', 'Intan', 'Joko',
  'Kirana', 'Lukman', 'Maya', 'Naufal', 'Olivia', 'Putra', 'Qori', 'Rizky', 'Salsabila', 'Tegar',
  'Umi', 'Vino', 'Wulan', 'Yusuf', 'Zahra', 'Adit', 'Bella', 'Candra', 'Dewi', 'Eko',
  'Fajar', 'Gina', 'Hendra', 'Indah', 'Jihan', 'Kemal', 'Laras', 'Miko', 'Nadia', 'Oscar',
]

const lastNames = [
  'Pratama', 'Wijaya', 'Saputra', 'Lestari', 'Haryono', 'Maharani', 'Akbar', 'Ramadhani', 'Kurniawan', 'Permata',
  'Pranoto', 'Anggraini', 'Nugroho', 'Safitri', 'Halim', 'Siregar', 'Wibowo', 'Rahmawati', 'Santoso', 'Firmansyah',
  'Gunawan', 'Hidayat', 'Iskandar', 'Jatmiko', 'Kusuma', 'Lubis', 'Maulana', 'Nurhaliza', 'Oktaviani', 'Purnama',
  'Rahayu', 'Setiawan', 'Tanjung', 'Utami', 'Verdian', 'Wardana', 'Yuliana', 'Zulkarnain', 'Ardiansyah', 'Baskara',
]

const feedbackPool = [
  'Pelafalan sudah jelas, perhatikan jeda antar kalimat.',
  'Struktur kalimat bagus, tambahkan variasi kosakata.',
  'Perlambat tempo bicara di bagian akhir rekaman.',
  'Intonasi masih datar, coba beri penekanan pada kata kunci.',
  'Sudah baik, latih lagi bagian yang masih terbata-bata.',
]

function mulberry32(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

const random = mulberry32(20261118)
const between = (min, max) => min + random() * (max - min)
const intBetween = (min, max) => Math.floor(between(min, max + 1))
const pick = (list) => list[Math.floor(random() * list.length)]
const chance = (probability) => random() < probability

function utcDateKey(date) {
  return date.toISOString().slice(0, 10)
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function buildStudents() {
  const students = []
  const seenNames = new Set()

  for (let index = 0; index < classrooms.length * STUDENTS_PER_CLASS; index += 1) {
    const classroom = classrooms[Math.floor(index / STUDENTS_PER_CLASS)]
    const position = index % STUDENTS_PER_CLASS
    const first = firstNames[position % firstNames.length]
    const last = lastNames[(position * 3 + Math.floor(index / STUDENTS_PER_CLASS) * 11) % lastNames.length]
    const displayName = `${first} ${last}`
    if (seenNames.has(displayName)) throw new Error(`Duplicate demo name generated: ${displayName}`)
    seenNames.add(displayName)

    const [minLevel, maxLevel] = classroom.levelRange
    const level = intBetween(minLevel, maxLevel)
    const xp = (level - 1) * 100 + intBetween(0, 99)
    const accuracy = between(classroom.accuracyRange[0], classroom.accuracyRange[1])
    const learningAttempts = intBetween(24, 180)
    const streak = chance(0.15) ? 0 : intBetween(1, 21)
    const lastActive = daysAgo(intBetween(0, 3))

    students.push({
      id: `demo-s-${String(index + 1).padStart(3, '0')}`,
      email: `siswa${String(index + 1).padStart(3, '0')}@${EMAIL_DOMAIN}`,
      displayName,
      password: STUDENT_PASSWORD,
      classroom,
      level,
      xp,
      accuracy,
      learningAttempts,
      correctAnswers: Math.round(learningAttempts * accuracy),
      streak,
      lastActiveDate: utcDateKey(lastActive),
    })
  }

  return students
}

const students = buildStudents()

if (dryRun) {
  const sample = students.slice(0, 3).map((student) => ({
    id: student.id,
    email: student.email,
    name: student.displayName,
    classroom: student.classroom.name,
    level: student.level,
    xp: student.xp,
    accuracy: Number(student.accuracy.toFixed(2)),
  }))
  console.log(JSON.stringify({
    ok: true,
    dryRun: true,
    teacher: { id: teacher.id, email: teacher.email },
    classrooms: classrooms.map((classroom) => ({ id: classroom.id, name: classroom.name, joinKey: classroom.joinKey })),
    studentCount: students.length,
    sample,
  }, null, 2))
  process.exit(0)
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
const app = getApps()[0] ?? initializeApp(
  projectId
    ? {
        credential: cert({
          projectId,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
        }),
      }
    : { projectId: 'demo-tuturai' },
)
const auth = getAuth(app)
const db = getFirestore(app)

console.log(`[demo-seed] target project: ${projectId ?? 'demo-tuturai'}`)

async function upsertAuthUser(user) {
  const payload = {
    email: user.email,
    password: user.password,
    displayName: user.displayName,
    emailVerified: true,
    disabled: false,
  }
  try {
    await auth.getUser(user.id)
    await auth.updateUser(user.id, payload)
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error
    await auth.createUser({ uid: user.id, ...payload })
  }
}

async function upsertAuthUsers(users) {
  const concurrency = 8
  for (let index = 0; index < users.length; index += concurrency) {
    await Promise.all(users.slice(index, index + concurrency).map(upsertAuthUser))
    process.stdout.write(`\r[demo-seed] auth users: ${Math.min(index + concurrency, users.length)}/${users.length}`)
  }
  process.stdout.write('\n')
}

await upsertAuthUsers([teacher, ...students])

// The teacher skill map groups attempts by the question's skill, so the sample
// has to span several skills instead of taking the first N published items.
const existingQuestions = await db.collection('questionBank').where('status', '==', 'published').limit(300).get()
const questionsBySkill = new Map()
for (const doc of existingQuestions.docs) {
  const skill = doc.data()?.skill
  if (typeof skill !== 'string' || skill.length === 0) continue
  const bucket = questionsBySkill.get(skill) ?? []
  if (bucket.length < 4) bucket.push({ id: doc.id, skill })
  questionsBySkill.set(skill, bucket)
}
const reusableQuestions = [...questionsBySkill.values()].flat()

const demoQuestions = [
  ['grammar', 'She ___ breakfast at seven every morning.', ['eat', 'eats', 'eating', 'eaten'], 1],
  ['grammar', 'They ___ to the library after class.', ['goes', 'going', 'go', 'gone'], 2],
  ['vocabulary', 'Choose the word closest in meaning to "brief".', ['short', 'loud', 'heavy', 'bright'], 0],
  ['vocabulary', 'The opposite of "expensive" is ___.', ['cheap', 'costly', 'rich', 'wide'], 0],
  ['pronunciation', 'Which word has the stress on the first syllable?', ['TAble', 'beGIN', 'aBOVE', 'rePEAT'], 0],
  ['listening', 'The speaker asks for the time of the next train. What do they need?', ['A schedule', 'A ticket price', 'A seat number', 'A luggage tag'], 0],
  ['intonation', 'Which sentence sounds like a polite request?', ['Could you open the window?', 'Open the window now.', 'You opened the window.', 'The window is open.'], 0],
  ['fluency', 'Pick the most natural way to keep a conversation going.', ['That makes sense, and then what happened?', 'Yes.', 'No.', 'Okay.'], 0],
  ['grammar', 'If I have time, I ___ you tonight.', ['call', 'will call', 'called', 'calling'], 1],
  ['vocabulary', 'A "commute" is the journey between ___.', ['home and work', 'two cities', 'two floors', 'two friends'], 0],
]

const hasSkillSpread = questionsBySkill.size >= 3 && reusableQuestions.length >= 6
const questionPool = hasSkillSpread
  ? reusableQuestions
  : demoQuestions.map(([skill, prompt, options, correctOption], index) => ({
      id: `demo-q-${String(index + 1).padStart(2, '0')}`,
      skill,
      prompt,
      options,
      correctOption,
    }))

const now = Timestamp.now()
const operations = []

function queueSet(collection, id, data) {
  operations.push({ collection, id, data })
}

queueSet('users', teacher.id, {
  id: teacher.id,
  email: teacher.email,
  displayName: teacher.displayName,
  role: 'teacher',
  school: SCHOOL,
  className: null,
  subject: 'English',
  xp: 0,
  level: 1,
  streak: 0,
  lastActiveDate: utcDateKey(new Date()),
  learningAttempts: 0,
  correctAnswers: 0,
  achievementIds: [],
  createdAt: now,
  updatedAt: now,
})

for (const classroom of classrooms) {
  queueSet('classrooms', classroom.id, {
    name: classroom.name,
    description: classroom.description,
    school: SCHOOL,
    teacherId: teacher.id,
    status: 'active',
    joinKeyHash: createHash('sha256').update(classroom.joinKey).digest('hex'),
    joinKeyRevoked: false,
    createdAt: now,
    updatedAt: now,
  })
  queueSet('classroomJoinKeys', createHash('sha256').update(classroom.joinKey).digest('hex'), {
    classroomId: classroom.id,
    createdAt: now,
  })
}

if (!hasSkillSpread) {
  for (const question of questionPool) {
    queueSet('questionBank', question.id, {
      contentType: 'question',
      skill: question.skill,
      level: 'beginner',
      prompt: question.prompt,
      options: question.options,
      correctOption: question.correctOption,
      explanation: 'Butir soal demo untuk data contoh dashboard guru.',
      tags: ['demo', question.skill],
      status: 'published',
      createdAt: now,
      updatedAt: now,
    })
  }
}

const assignmentsByClass = new Map()
for (const classroom of classrooms) {
  const ids = []
  for (const [index, [title, instructions, maxAttempts]] of assignmentTemplates.entries()) {
    const id = `${classroom.id}-assignment-${index + 1}`
    ids.push(id)
    queueSet('assignments', id, {
      classId: classroom.id,
      title,
      instructions,
      status: 'published',
      maxAttempts,
      dueAt: index === 2 ? Timestamp.fromDate(daysAgo(-5)) : Timestamp.fromDate(daysAgo(4 + index * 3)),
      createdAt: Timestamp.fromDate(daysAgo(24)),
      updatedAt: now,
    })
  }
  assignmentsByClass.set(classroom.id, ids)
}

for (const student of students) {
  queueSet('users', student.id, {
    id: student.id,
    email: student.email,
    displayName: student.displayName,
    role: 'student',
    school: SCHOOL,
    className: student.classroom.name,
    subject: null,
    xp: student.xp,
    level: student.level,
    streak: student.streak,
    lastActiveDate: student.lastActiveDate,
    learningAttempts: student.learningAttempts,
    correctAnswers: student.correctAnswers,
    achievementIds: [],
    createdAt: Timestamp.fromDate(daysAgo(intBetween(30, 60))),
    updatedAt: now,
  })

  queueSet('classMemberships', `${student.classroom.id}_${student.id}`, {
    classId: student.classroom.id,
    studentId: student.id,
    status: 'active',
    joinedAt: Timestamp.fromDate(daysAgo(intBetween(20, 45))),
  })

  const assignmentIds = assignmentsByClass.get(student.classroom.id)
  for (const [index, assignmentId] of assignmentIds.entries()) {
    if (!chance(0.85)) continue
    const roll = random()
    const status = roll < 0.45 ? 'approved' : roll < 0.7 ? 'pending_review' : roll < 0.82 ? 'submitted' : 'returned'
    const graded = status === 'approved' || status === 'returned'
    const submittedAt = Timestamp.fromDate(daysAgo(intBetween(1, 20)))
    queueSet('submissions', `${assignmentId}_${student.id}`, {
      assignmentId,
      studentId: student.id,
      attempt: chance(0.2) ? 2 : 1,
      status,
      isLate: chance(0.2),
      teacherFeedback: graded ? pick(feedbackPool) : null,
      teacherScore: status === 'approved' ? intBetween(62, 98) : status === 'returned' ? intBetween(45, 72) : null,
      gradedAt: graded ? Timestamp.fromDate(daysAgo(intBetween(0, 6))) : null,
      submittedAt,
      updatedAt: submittedAt,
      files: [],
      links: [],
    })
    void index
  }

  const assessmentCount = intBetween(1, 3)
  for (let index = 0; index < assessmentCount; index += 1) {
    const overall = Math.max(35, Math.min(99, Math.round(student.accuracy * 100 + between(-9, 9))))
    const createdAt = daysAgo(intBetween(0, 29))
    queueSet('assessments', `demo-assess-${student.id}-${index + 1}`, {
      id: `demo-assess-${student.id}-${index + 1}`,
      sessionId: `demo-session-${student.id}-${index + 1}`,
      studentId: student.id,
      questionId: pick(questionPool).id,
      mode: 'speaking',
      pronunciation: Math.max(30, Math.min(99, overall + intBetween(-8, 8))),
      fluency: Math.max(30, Math.min(99, overall + intBetween(-8, 8))),
      intonation: Math.max(30, Math.min(99, overall + intBetween(-10, 6))),
      grammar: Math.max(30, Math.min(99, overall + intBetween(-7, 9))),
      vocabulary: Math.max(30, Math.min(99, overall + intBetween(-6, 10))),
      overall,
      transcript: `Rekaman demo dari ${student.displayName}.`,
      feedback: pick(feedbackPool),
      confidence: Number(between(0.62, 0.96).toFixed(2)),
      error: null,
      createdAt: createdAt.toISOString(),
    })
  }

  const attemptCount = intBetween(10, 24)
  for (let index = 0; index < attemptCount; index += 1) {
    const question = pick(questionPool)
    const isCorrect = chance(student.accuracy)
    const createdAt = daysAgo(intBetween(0, 29))
    queueSet('questionAttempts', `${student.id}_demo-attempt-${index + 1}`, {
      id: `${student.id}_demo-attempt-${index + 1}`,
      studentId: student.id,
      questionId: question.id,
      classroomId: student.classroom.id,
      skill: question.skill,
      selectedOption: isCorrect ? 0 : 1,
      correctOption: 0,
      isCorrect,
      explanation: 'Percobaan demo untuk data contoh dashboard guru.',
      createdAt: Timestamp.fromDate(createdAt),
    })
  }
}

const BATCH_LIMIT = 400
let written = 0
for (let index = 0; index < operations.length; index += BATCH_LIMIT) {
  const batch = db.batch()
  for (const operation of operations.slice(index, index + BATCH_LIMIT)) {
    batch.set(db.collection(operation.collection).doc(operation.id), operation.data)
  }
  await batch.commit()
  written += Math.min(BATCH_LIMIT, operations.length - index)
  process.stdout.write(`\r[demo-seed] firestore docs: ${written}/${operations.length}`)
}
process.stdout.write('\n')

const counts = operations.reduce((totals, operation) => {
  totals[operation.collection] = (totals[operation.collection] ?? 0) + 1
  return totals
}, {})

console.log(JSON.stringify({
  ok: true,
  projectId: projectId ?? 'demo-tuturai',
  teacher: { id: teacher.id, email: teacher.email, password: TEACHER_PASSWORD },
  studentPassword: STUDENT_PASSWORD,
  classrooms: classrooms.map((classroom) => ({ id: classroom.id, name: classroom.name, joinKey: classroom.joinKey })),
  studentCount: students.length,
  questionSource: hasSkillSpread ? `existing questionBank (${questionsBySkill.size} skills)` : 'demo questions created',
  counts,
}, null, 2))
