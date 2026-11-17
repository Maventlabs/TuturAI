import { FieldValue, Timestamp, type DocumentData } from 'firebase-admin/firestore'
import {
  READING_LEVELS,
  READING_PASSAGE_COUNT,
  READING_QUESTIONS_PER_PASSAGE,
  applyLearningActivity,
  calculateReadingScore,
  levelForXp,
  xpForAttempt,
  type QuestionLevel,
  type ReadingAttemptSummary,
  type ReadingLevelStat,
  type ReadingPassageView,
  type ReadingQuestionView,
  type ReadingResultView,
  type ReadingReviewItem,
  type ReadingSessionStatus,
  type ReadingSessionView,
} from '@tuturai/domain'
import { getAdminDb } from '@/lib/firebase/admin'
import { invalidateNamespaces } from '@/lib/cache'

export const READING_ATTEMPTS_COLLECTION = 'readingAttempts'
export const READING_ANSWERS_COLLECTION = 'readingAnswers'
export const READING_SESSIONS_COLLECTION = 'readingSessions'
export const READING_PASSAGES_COLLECTION = 'readingPassages'
const QUESTION_BANK_COLLECTION = 'questionBank'

/** A practice session counts as a passing learning activity at or above this score. */
const READING_PASS_MARK = 60

function toMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return 0
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    const current = copy[index]
    copy[index] = copy[swap]
    copy[swap] = current
  }
  return copy
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function normalizeAnswers(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {}
  const answers: Record<string, number> = {}
  for (const [questionId, selected] of Object.entries(value as Record<string, unknown>)) {
    if (Number.isInteger(selected) && (selected as number) >= 0) answers[questionId] = selected as number
  }
  return answers
}

function normalizeLevel(value: unknown): QuestionLevel {
  return value === 'intermediate' || value === 'advanced' ? value : 'beginner'
}

function normalizeStatus(value: unknown): ReadingSessionStatus {
  if (value === 'submitted') return 'submitted'
  if (value === 'abandoned') return 'abandoned'
  return 'in_progress'
}

function toQuestionView(id: string, passageId: string, data: DocumentData | undefined): ReadingQuestionView | null {
  if (!data) return null
  const options = stringList(data.options)
  if (options.length < 2) return null
  if (typeof data.prompt !== 'string' || !data.prompt.trim()) return null
  if (!Number.isInteger(data.correctOption)) return null
  return {
    id,
    passageId,
    prompt: data.prompt,
    options,
    questionType: typeof data.questionType === 'string' ? data.questionType : undefined,
  }
}

function toPassageView(id: string, data: DocumentData | undefined): ReadingPassageView | null {
  if (!data) return null
  const paragraphs = stringList(data.paragraphs)
  if (paragraphs.length === 0) return null
  return {
    id,
    title: typeof data.title === 'string' ? data.title : 'Reading passage',
    topic: typeof data.topic === 'string' ? data.topic : undefined,
    paragraphs,
    questionIds: stringList(data.questionIds),
  }
}

async function fetchQuestionDocs(questionIds: string[]) {
  if (questionIds.length === 0) return new Map<string, DocumentData>()
  const db = getAdminDb()
  const snapshots = await db.getAll(...questionIds.map((id) => db.collection(QUESTION_BANK_COLLECTION).doc(id)))
  const map = new Map<string, DocumentData>()
  for (const snapshot of snapshots) {
    if (snapshot.exists) map.set(snapshot.id, snapshot.data() ?? {})
  }
  return map
}

async function fetchPassageDocs(passageIds: string[]) {
  if (passageIds.length === 0) return new Map<string, DocumentData>()
  const db = getAdminDb()
  const snapshots = await db.getAll(...passageIds.map((id) => db.collection(READING_PASSAGES_COLLECTION).doc(id)))
  const map = new Map<string, DocumentData>()
  for (const snapshot of snapshots) {
    if (snapshot.exists) map.set(snapshot.id, snapshot.data() ?? {})
  }
  return map
}

export interface ReadingSelection {
  passages: ReadingPassageView[]
  questions: ReadingQuestionView[]
}

/**
 * Draws two published passages of one level with their five questions each.
 *
 * The published bank is read in one bounded window and filtered in memory, the
 * same way the quiz draws its reading section, so no composite index is needed
 * for the level + status combination.
 */
export async function selectReadingPassages(level: QuestionLevel): Promise<ReadingSelection> {
  const db = getAdminDb()
  const [passageSnapshot, bankSnapshot] = await Promise.all([
    db.collection(READING_PASSAGES_COLLECTION).where('status', '==', 'published').limit(200).get(),
    db.collection(QUESTION_BANK_COLLECTION).where('status', '==', 'published').limit(1000).get(),
  ])

  const bank = new Map<string, DocumentData>(bankSnapshot.docs.map((doc) => [doc.id, doc.data()]))
  const candidates = passageSnapshot.docs.filter((doc) => doc.data().level === level)
  const chosen = shuffle(candidates).slice(0, READING_PASSAGE_COUNT)
  if (chosen.length < READING_PASSAGE_COUNT) throw new Error('READING_BANK_INCOMPLETE')

  const passages: ReadingPassageView[] = []
  const questions: ReadingQuestionView[] = []

  for (const doc of chosen) {
    const passage = toPassageView(doc.id, doc.data())
    if (!passage || passage.questionIds.length !== READING_QUESTIONS_PER_PASSAGE) {
      throw new Error('READING_BANK_INCOMPLETE')
    }
    const items = passage.questionIds.map((id) => toQuestionView(id, passage.id, bank.get(id)))
    if (items.some((item) => item === null)) throw new Error('READING_BANK_INCOMPLETE')
    passages.push(passage)
    questions.push(...(items as ReadingQuestionView[]))
  }

  return { passages, questions }
}

function gradeSession(input: {
  questionIds: string[]
  answers: Record<string, number>
  questionDocs: Map<string, DocumentData>
}): { score: number; correct: number; incorrect: number; unanswered: number; review: ReadingReviewItem[] } {
  const review: ReadingReviewItem[] = []
  let correct = 0
  let incorrect = 0
  let unanswered = 0

  for (const questionId of input.questionIds) {
    const data = input.questionDocs.get(questionId)
    if (!data) continue
    const options = stringList(data.options)
    const correctOption = Number.isInteger(data.correctOption) ? (data.correctOption as number) : -1
    const selected = Object.prototype.hasOwnProperty.call(input.answers, questionId)
      ? input.answers[questionId]
      : null
    const isCorrect = selected !== null && selected === correctOption

    if (selected === null) unanswered += 1
    else if (isCorrect) correct += 1
    else incorrect += 1

    review.push({
      questionId,
      passageId: typeof data.passageId === 'string' ? data.passageId : '',
      prompt: typeof data.prompt === 'string' ? data.prompt : '',
      options,
      selectedOption: selected,
      correctOption,
      isCorrect,
      explanation: typeof data.explanation === 'string' ? data.explanation : '',
      questionType: typeof data.questionType === 'string' ? data.questionType : undefined,
    })
  }

  const total = correct + incorrect + unanswered
  return { score: calculateReadingScore(correct, total), correct, incorrect, unanswered, review }
}

async function buildSessionView(attemptId: string, data: DocumentData): Promise<ReadingSessionView> {
  const questionIds = stringList(data.questionIds)
  const passageIds = stringList(data.passageIds)
  const answers = normalizeAnswers(data.answers)
  const status = normalizeStatus(data.status)

  const [questionDocs, passageDocs] = await Promise.all([
    fetchQuestionDocs(questionIds),
    fetchPassageDocs(passageIds),
  ])

  const passages = passageIds
    .map((id) => toPassageView(id, passageDocs.get(id)))
    .filter((passage): passage is ReadingPassageView => passage !== null)

  const questions = questionIds
    .map((id) => {
      const passageId = typeof questionDocs.get(id)?.passageId === 'string'
        ? (questionDocs.get(id)!.passageId as string)
        : ''
      return toQuestionView(id, passageId, questionDocs.get(id))
    })
    .filter((question): question is ReadingQuestionView => question !== null)

  const startedMs = toMillis(data.startedAt)
  const submittedMs = toMillis(data.submittedAt)

  let result: ReadingResultView | null = null
  if (status === 'submitted') {
    const graded = gradeSession({ questionIds, answers, questionDocs })
    result = {
      score: typeof data.score === 'number' ? data.score : graded.score,
      correct: typeof data.correctCount === 'number' ? data.correctCount : graded.correct,
      incorrect: typeof data.incorrectCount === 'number' ? data.incorrectCount : graded.incorrect,
      unanswered: typeof data.unansweredCount === 'number' ? data.unansweredCount : graded.unanswered,
      total: questionIds.length,
      durationSeconds: typeof data.durationSeconds === 'number'
        ? data.durationSeconds
        : Math.max(0, Math.round(((submittedMs || Date.now()) - startedMs) / 1_000)),
      submittedAt: new Date(submittedMs || Date.now()).toISOString(),
      review: graded.review,
    }
  }

  return {
    id: attemptId,
    level: normalizeLevel(data.level),
    status,
    startedAt: new Date(startedMs).toISOString(),
    submittedAt: submittedMs ? new Date(submittedMs).toISOString() : null,
    questions,
    passages,
    answers,
    result,
  }
}

/**
 * Grades and closes a session exactly once. The transaction re-reads the
 * attempt so a double submit cannot score the same session or award XP twice.
 */
async function finalizeReadingSession(input: { studentId: string; attemptId: string }): Promise<void> {
  const db = getAdminDb()
  const attemptRef = db.collection(READING_ATTEMPTS_COLLECTION).doc(input.attemptId)
  const userRef = db.collection('users').doc(input.studentId)

  const snapshot = await attemptRef.get()
  if (!snapshot.exists) throw new Error('READING_ATTEMPT_NOT_FOUND')
  const data = snapshot.data() ?? {}
  if (data.studentId !== input.studentId) throw new Error('READING_ATTEMPT_NOT_FOUND')
  if (data.status !== 'in_progress') return

  const questionIds = stringList(data.questionIds)
  const answers = normalizeAnswers(data.answers)
  const questionDocs = await fetchQuestionDocs(questionIds)
  const graded = gradeSession({ questionIds, answers, questionDocs })

  const now = Date.now()
  const startedMs = toMillis(data.startedAt)
  const durationSeconds = Math.max(0, Math.round((now - startedMs) / 1_000))

  await db.runTransaction(async (transaction) => {
    const [attemptSnapshot, userSnapshot] = await Promise.all([
      transaction.get(attemptRef),
      transaction.get(userRef),
    ])
    const current = attemptSnapshot.data() ?? {}
    if (current.status !== 'in_progress') return

    transaction.update(attemptRef, {
      status: 'submitted',
      submittedAt: Timestamp.fromMillis(now),
      score: graded.score,
      correctCount: graded.correct,
      incorrectCount: graded.incorrect,
      unansweredCount: graded.unanswered,
      durationSeconds,
      updatedAt: Timestamp.fromMillis(now),
    })

    if (userSnapshot.exists) {
      const user = userSnapshot.data() ?? {}
      const currentXp = typeof user.xp === 'number' ? user.xp : 0
      const earnedXp = xpForAttempt(graded.score)
      const progress = applyLearningActivity(
        {
          streak: user.streak,
          lastActiveDate: user.lastActiveDate,
          totalAttempts: user.learningAttempts,
          correctAnswers: user.correctAnswers,
          achievementIds: user.achievementIds,
        },
        graded.score >= READING_PASS_MARK,
      )
      transaction.update(userRef, {
        xp: FieldValue.increment(earnedXp),
        level: levelForXp(currentXp + earnedXp),
        streak: progress.streak,
        lastActiveDate: progress.lastActiveDate,
        learningAttempts: progress.totalAttempts,
        correctAnswers: progress.correctAnswers,
        achievementIds: progress.achievementIds,
        updatedAt: Timestamp.fromMillis(now),
      })
    }

    transaction.set(
      db.collection(READING_SESSIONS_COLLECTION).doc(input.studentId),
      { attemptId: input.attemptId, status: 'submitted', updatedAt: Timestamp.fromMillis(now) },
      { merge: true },
    )
  })

  const batch = db.batch()
  for (const item of graded.review) {
    batch.set(
      db.collection(READING_ANSWERS_COLLECTION).doc(`${input.attemptId}_${item.questionId}`),
      {
        attemptId: input.attemptId,
        studentId: input.studentId,
        questionId: item.questionId,
        passageId: item.passageId,
        selectedOption: item.selectedOption,
        correctOption: item.correctOption,
        isCorrect: item.isCorrect,
        score: item.isCorrect ? 1 : 0,
        createdAt: Timestamp.fromMillis(now),
      },
      { merge: true },
    )
  }
  await batch.commit()

  await invalidateNamespaces(
    `profile:${input.studentId}`,
    `analytics:dashboard:${input.studentId}`,
    `analytics:learningStats:${input.studentId}`,
  )
}

/**
 * Starts a session, or resumes the one already running at the same level.
 * Picking a different level abandons the unfinished session instead of silently
 * handing the student material they did not choose.
 */
export async function startReadingSession(input: {
  studentId: string
  level: QuestionLevel
}): Promise<ReadingSessionView> {
  const db = getAdminDb()
  const sessionRef = db.collection(READING_SESSIONS_COLLECTION).doc(input.studentId)
  const sessionSnapshot = await sessionRef.get()
  const pointer = sessionSnapshot.exists ? sessionSnapshot.data()?.attemptId : null

  if (typeof pointer === 'string') {
    const live = await getReadingSessionState({ studentId: input.studentId, attemptId: pointer })
    if (live && live.status === 'in_progress') {
      if (live.level === input.level) return live
      await db.collection(READING_ATTEMPTS_COLLECTION).doc(pointer).update({
        status: 'abandoned',
        updatedAt: Timestamp.fromMillis(Date.now()),
      })
    }
  }

  const selection = await selectReadingPassages(input.level)
  const attemptRef = db.collection(READING_ATTEMPTS_COLLECTION).doc()
  const now = Date.now()

  await db.runTransaction(async (transaction) => {
    transaction.create(attemptRef, {
      studentId: input.studentId,
      level: input.level,
      status: 'in_progress',
      questionIds: selection.questions.map((question) => question.id),
      passageIds: selection.passages.map((passage) => passage.id),
      answers: {},
      startedAt: Timestamp.fromMillis(now),
      submittedAt: null,
      score: null,
      correctCount: null,
      incorrectCount: null,
      unansweredCount: null,
      durationSeconds: null,
      createdAt: Timestamp.fromMillis(now),
      updatedAt: Timestamp.fromMillis(now),
    })
    transaction.set(sessionRef, {
      attemptId: attemptRef.id,
      level: input.level,
      status: 'in_progress',
      updatedAt: Timestamp.fromMillis(now),
    })
  })

  const state = await getReadingSessionState({ studentId: input.studentId, attemptId: attemptRef.id })
  if (!state) throw new Error('READING_ATTEMPT_NOT_FOUND')
  return state
}

export async function getReadingSessionState(input: {
  studentId: string
  attemptId: string
}): Promise<ReadingSessionView | null> {
  const db = getAdminDb()
  const snapshot = await db.collection(READING_ATTEMPTS_COLLECTION).doc(input.attemptId).get()
  if (!snapshot.exists) return null
  const data = snapshot.data() ?? {}
  if (data.studentId !== input.studentId) return null
  return buildSessionView(snapshot.id, data)
}

export async function getActiveReadingSession(studentId: string): Promise<ReadingSessionView | null> {
  const db = getAdminDb()
  const sessionSnapshot = await db.collection(READING_SESSIONS_COLLECTION).doc(studentId).get()
  const pointer = sessionSnapshot.exists ? sessionSnapshot.data()?.attemptId : null
  if (typeof pointer !== 'string') return null
  const state = await getReadingSessionState({ studentId, attemptId: pointer })
  return state && state.status === 'in_progress' ? state : null
}

export async function saveReadingAnswer(input: {
  studentId: string
  attemptId: string
  questionId: string
  selectedOption: number
}): Promise<{ savedAt: string }> {
  const db = getAdminDb()
  const attemptRef = db.collection(READING_ATTEMPTS_COLLECTION).doc(input.attemptId)
  const snapshot = await attemptRef.get()
  if (!snapshot.exists) throw new Error('READING_ATTEMPT_NOT_FOUND')
  const data = snapshot.data() ?? {}
  if (data.studentId !== input.studentId) throw new Error('READING_ATTEMPT_NOT_FOUND')
  if (data.status !== 'in_progress') throw new Error('READING_ATTEMPT_FINISHED')

  const questionIds = stringList(data.questionIds)
  if (!questionIds.includes(input.questionId)) throw new Error('READING_QUESTION_NOT_IN_ATTEMPT')

  const questionSnapshot = await db.collection(QUESTION_BANK_COLLECTION).doc(input.questionId).get()
  const options = stringList(questionSnapshot.data()?.options)
  if (input.selectedOption >= options.length) throw new Error('READING_OPTION_OUT_OF_RANGE')

  const now = Date.now()
  await db.runTransaction(async (transaction) => {
    const fresh = await transaction.get(attemptRef)
    if ((fresh.data() ?? {}).status !== 'in_progress') throw new Error('READING_ATTEMPT_FINISHED')
    transaction.update(attemptRef, {
      [`answers.${input.questionId}`]: input.selectedOption,
      updatedAt: Timestamp.fromMillis(now),
    })
  })

  return { savedAt: new Date(now).toISOString() }
}

export async function submitReadingSession(input: {
  studentId: string
  attemptId: string
}): Promise<ReadingSessionView> {
  const db = getAdminDb()
  const snapshot = await db.collection(READING_ATTEMPTS_COLLECTION).doc(input.attemptId).get()
  if (!snapshot.exists) throw new Error('READING_ATTEMPT_NOT_FOUND')
  if ((snapshot.data() ?? {}).studentId !== input.studentId) throw new Error('READING_ATTEMPT_NOT_FOUND')

  if ((snapshot.data() ?? {}).status === 'in_progress') {
    await finalizeReadingSession({ studentId: input.studentId, attemptId: input.attemptId })
  }

  const state = await getReadingSessionState({ studentId: input.studentId, attemptId: input.attemptId })
  if (!state) throw new Error('READING_ATTEMPT_NOT_FOUND')
  return state
}

export async function listReadingAttempts(studentId: string, limit = 10): Promise<ReadingAttemptSummary[]> {
  const db = getAdminDb()
  const snapshot = await db
    .collection(READING_ATTEMPTS_COLLECTION)
    .where('studentId', '==', studentId)
    .limit(50)
    .get()

  return snapshot.docs
    .map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        level: normalizeLevel(data.level),
        status: normalizeStatus(data.status),
        startedAt: new Date(toMillis(data.startedAt)).toISOString(),
        submittedAt: data.submittedAt ? new Date(toMillis(data.submittedAt)).toISOString() : null,
        score: typeof data.score === 'number' ? data.score : null,
        correct: typeof data.correctCount === 'number' ? data.correctCount : null,
        total: stringList(data.questionIds).length,
      }
    })
    .filter((attempt) => attempt.status === 'submitted')
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
    .slice(0, limit)
}

/** Passage supply per level plus the student's own record, for the level gate. */
export async function getReadingLevelStats(studentId: string): Promise<ReadingLevelStat[]> {
  const db = getAdminDb()
  const [passageSnapshot, attempts] = await Promise.all([
    db.collection(READING_PASSAGES_COLLECTION).where('status', '==', 'published').limit(200).get(),
    listReadingAttempts(studentId, 50),
  ])

  return READING_LEVELS.map((level) => {
    const passages = passageSnapshot.docs.filter((doc) => doc.data().level === level)
    const questions = passages.reduce((sum, doc) => sum + stringList(doc.data().questionIds).length, 0)
    const levelAttempts = attempts.filter((attempt) => attempt.level === level)
    const scores = levelAttempts
      .map((attempt) => attempt.score)
      .filter((score): score is number => typeof score === 'number')

    return {
      level,
      passages: passages.length,
      questions,
      attempts: levelAttempts.length,
      bestScore: scores.length > 0 ? Math.max(...scores) : null,
    }
  })
}

export async function getReadingOverview(studentId: string): Promise<{
  levels: ReadingLevelStat[]
  active: ReadingSessionView | null
  history: ReadingAttemptSummary[]
}> {
  const [levels, active, history] = await Promise.all([
    getReadingLevelStats(studentId),
    getActiveReadingSession(studentId),
    listReadingAttempts(studentId, 8),
  ])
  return { levels, active, history }
}
