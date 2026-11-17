import { FieldValue, Timestamp, type DocumentData } from 'firebase-admin/firestore'
import {
  QUIZ_DURATION_MS,
  QUIZ_QUESTIONS_PER_PASSAGE,
  QUIZ_QUESTIONS_PER_SECTION,
  QUIZ_READING_PASSAGE_COUNT,
  QUIZ_SECTION_IDS,
  applyLearningActivity,
  calculateQuizScore,
  levelForXp,
  remainingQuizMs,
  xpForAttempt,
  type QuestionLevel,
  type QuizAttemptStatus,
  type QuizAttemptSummary,
  type QuizAttemptView,
  type QuizPassageView,
  type QuizQuestionView,
  type QuizResultView,
  type QuizReviewItem,
  type QuizSectionId,
  type QuizSectionTally,
} from '@tuturai/domain'
import { getAdminDb } from '@/lib/firebase/admin'
import { invalidateNamespaces } from '@/lib/cache'

export const QUIZ_ATTEMPTS_COLLECTION = 'quizAttempts'
export const QUIZ_ANSWERS_COLLECTION = 'quizAnswers'
export const QUIZ_SESSIONS_COLLECTION = 'quizSessions'
export const READING_PASSAGES_COLLECTION = 'readingPassages'
const QUESTION_BANK_COLLECTION = 'questionBank'

/** A quiz attempt counts as a passing learning activity at or above this score. */
const QUIZ_PASS_MARK = 60

type QuizSections = Record<QuizSectionId, string[]>

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

function normalizeSections(value: unknown): QuizSections {
  const source = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  return {
    reading: stringList(source.reading),
    listening: stringList(source.listening),
    general: stringList(source.general),
  }
}

function sectionForQuestion(sections: QuizSections, questionId: string): QuizSectionId {
  return QUIZ_SECTION_IDS.find((section) => sections[section].includes(questionId)) ?? 'general'
}

function toQuestionView(id: string, section: QuizSectionId, data: DocumentData | undefined): QuizQuestionView | null {
  if (!data) return null
  const options = stringList(data.options)
  if (options.length < 2) return null
  if (typeof data.prompt !== 'string' || !data.prompt.trim()) return null
  if (!Number.isInteger(data.correctOption)) return null
  return {
    id,
    section,
    prompt: data.prompt,
    options,
    passageId: typeof data.passageId === 'string' ? data.passageId : undefined,
    audioUrl: typeof data.audioUrl === 'string' ? data.audioUrl : undefined,
    questionType: typeof data.questionType === 'string' ? data.questionType : undefined,
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

export interface QuizSelection {
  questions: QuizQuestionView[]
  passages: QuizPassageView[]
  sections: QuizSections
  passageIds: string[]
}

/**
 * Draws one exam for a level: two reading passages with five questions each,
 * ten listening items from the recorded audio bank, and ten general items.
 *
 * The published bank is read in one bounded window and filtered in memory, the
 * same way the rest of the question bank is read, so no composite index is
 * required for the level + content-type combination.
 */
export async function selectQuizQuestions(level: QuestionLevel): Promise<QuizSelection> {
  const db = getAdminDb()
  const [bankSnapshot, passageSnapshot] = await Promise.all([
    db.collection(QUESTION_BANK_COLLECTION).where('status', '==', 'published').limit(1000).get(),
    db.collection(READING_PASSAGES_COLLECTION).where('status', '==', 'published').limit(200).get(),
  ])

  const bank = new Map<string, DocumentData>(bankSnapshot.docs.map((doc) => [doc.id, doc.data()]))
  const passages = passageSnapshot.docs
    .map((doc) => ({ id: doc.id, data: doc.data() }))
    .filter((entry) => entry.data.level === level)

  const chosenPassages = shuffle(passages).slice(0, QUIZ_READING_PASSAGE_COUNT)
  if (chosenPassages.length < QUIZ_READING_PASSAGE_COUNT) throw new Error('QUIZ_BANK_INCOMPLETE')

  const readingQuestions: QuizQuestionView[] = []
  const passageViews: QuizPassageView[] = []

  for (const passage of chosenPassages) {
    const questionIds = stringList(passage.data.questionIds)
    if (questionIds.length !== QUIZ_QUESTIONS_PER_PASSAGE) throw new Error('QUIZ_BANK_INCOMPLETE')
    const items = questionIds.map((id) => toQuestionView(id, 'reading', bank.get(id)))
    if (items.some((item) => item === null)) throw new Error('QUIZ_BANK_INCOMPLETE')
    readingQuestions.push(...(items as QuizQuestionView[]))
    passageViews.push({
      id: passage.id,
      title: typeof passage.data.title === 'string' ? passage.data.title : 'Reading passage',
      paragraphs: stringList(passage.data.paragraphs),
      questionIds,
    })
  }

  const pickSection = (contentType: string) => {
    const candidates = [...bank.entries()].filter(
      ([, data]) => data.contentType === contentType && data.level === level,
    )
    const picked = shuffle(candidates).slice(0, QUIZ_QUESTIONS_PER_SECTION)
    if (picked.length < QUIZ_QUESTIONS_PER_SECTION) throw new Error('QUIZ_BANK_INCOMPLETE')
    return picked
  }

  const listening = pickSection('listening')
    .map(([id, data]) => toQuestionView(id, 'listening', data))
  const general = pickSection('general')
    .map(([id, data]) => toQuestionView(id, 'general', data))

  if (listening.some((item) => item === null) || general.some((item) => item === null)) {
    throw new Error('QUIZ_BANK_INCOMPLETE')
  }

  const listeningQuestions = listening as QuizQuestionView[]
  const generalQuestions = general as QuizQuestionView[]

  return {
    questions: [...readingQuestions, ...listeningQuestions, ...generalQuestions],
    passages: passageViews,
    sections: {
      reading: readingQuestions.map((question) => question.id),
      listening: listeningQuestions.map((question) => question.id),
      general: generalQuestions.map((question) => question.id),
    },
    passageIds: passageViews.map((passage) => passage.id),
  }
}

function gradeAttempt(input: {
  questionIds: string[]
  sections: QuizSections
  answers: Record<string, number>
  questionDocs: Map<string, DocumentData>
}): { score: ReturnType<typeof calculateQuizScore>; review: QuizReviewItem[] } {
  const tallies: Record<QuizSectionId, QuizSectionTally> = {
    reading: { correct: 0, incorrect: 0, unanswered: 0 },
    listening: { correct: 0, incorrect: 0, unanswered: 0 },
    general: { correct: 0, incorrect: 0, unanswered: 0 },
  }
  const review: QuizReviewItem[] = []

  for (const questionId of input.questionIds) {
    const data = input.questionDocs.get(questionId)
    if (!data) continue
    const section = sectionForQuestion(input.sections, questionId)
    const options = stringList(data.options)
    const correctOption = Number.isInteger(data.correctOption) ? (data.correctOption as number) : -1
    const selected = Object.prototype.hasOwnProperty.call(input.answers, questionId)
      ? input.answers[questionId]
      : null
    const isCorrect = selected !== null && selected === correctOption

    if (selected === null) tallies[section].unanswered += 1
    else if (isCorrect) tallies[section].correct += 1
    else tallies[section].incorrect += 1

    review.push({
      questionId,
      section,
      prompt: typeof data.prompt === 'string' ? data.prompt : '',
      options,
      selectedOption: selected,
      correctOption,
      isCorrect,
      explanation: typeof data.explanation === 'string' ? data.explanation : '',
      passageId: typeof data.passageId === 'string' ? data.passageId : undefined,
      audioUrl: typeof data.audioUrl === 'string' ? data.audioUrl : undefined,
    })
  }

  return { score: calculateQuizScore(tallies), review }
}

async function buildAttemptView(
  attemptId: string,
  data: DocumentData,
  now: number,
): Promise<QuizAttemptView> {
  const db = getAdminDb()
  const sections = normalizeSections(data.sections)
  const questionIds = stringList(data.questionIds)
  const answers = normalizeAnswers(data.answers)
  const passageIds = stringList(data.passageIds)

  const [questionDocs, passageSnapshots] = await Promise.all([
    fetchQuestionDocs(questionIds),
    passageIds.length > 0
      ? db.getAll(...passageIds.map((id) => db.collection(READING_PASSAGES_COLLECTION).doc(id)))
      : Promise.resolve([]),
  ])

  const questions = questionIds
    .map((id) => toQuestionView(id, sectionForQuestion(sections, id), questionDocs.get(id)))
    .filter((question): question is QuizQuestionView => question !== null)

  const passages: QuizPassageView[] = passageSnapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) => ({
      id: snapshot.id,
      title: typeof snapshot.data()?.title === 'string' ? (snapshot.data()!.title as string) : 'Reading passage',
      paragraphs: stringList(snapshot.data()?.paragraphs),
      questionIds: stringList(snapshot.data()?.questionIds),
    }))

  const status = (data.status === 'submitted' || data.status === 'expired' ? data.status : 'in_progress') as QuizAttemptStatus
  const deadlineMs = toMillis(data.deadlineAt)
  const startedMs = toMillis(data.startedAt)

  let result: QuizResultView | null = null
  if (status !== 'in_progress') {
    const graded = gradeAttempt({ questionIds, sections, answers, questionDocs })
    const submittedMs = toMillis(data.submittedAt) || now
    result = {
      finalScore: typeof data.finalScore === 'number' ? data.finalScore : graded.score.finalScore,
      sections: graded.score.sections,
      correct: graded.score.correct,
      incorrect: graded.score.incorrect,
      unanswered: graded.score.unanswered,
      total: graded.score.total,
      durationSeconds: typeof data.durationSeconds === 'number'
        ? data.durationSeconds
        : Math.max(0, Math.round((submittedMs - startedMs) / 1_000)),
      submittedAt: new Date(submittedMs).toISOString(),
      status,
      review: graded.review,
    }
  }

  return {
    id: attemptId,
    level: (data.level === 'intermediate' || data.level === 'advanced' ? data.level : 'beginner') as QuestionLevel,
    status,
    startedAt: new Date(startedMs).toISOString(),
    deadlineAt: new Date(deadlineMs).toISOString(),
    serverNow: new Date(now).toISOString(),
    remainingMs: status === 'in_progress' ? remainingQuizMs(deadlineMs, now) : 0,
    questions,
    passages,
    answers,
    result,
  }
}

/**
 * Grades and closes an attempt exactly once. The transaction re-reads the
 * attempt so a submit racing the deadline cannot score the same attempt twice
 * or award XP twice.
 */
async function finalizeQuizAttempt(input: {
  studentId: string
  attemptId: string
  reason: 'submitted' | 'expired'
}): Promise<void> {
  const db = getAdminDb()
  const attemptRef = db.collection(QUIZ_ATTEMPTS_COLLECTION).doc(input.attemptId)
  const userRef = db.collection('users').doc(input.studentId)

  const snapshot = await attemptRef.get()
  if (!snapshot.exists) throw new Error('QUIZ_ATTEMPT_NOT_FOUND')
  const data = snapshot.data() ?? {}
  if (data.studentId !== input.studentId) throw new Error('QUIZ_ATTEMPT_NOT_FOUND')
  if (data.status !== 'in_progress') return

  const questionIds = stringList(data.questionIds)
  const sections = normalizeSections(data.sections)
  const answers = normalizeAnswers(data.answers)
  const questionDocs = await fetchQuestionDocs(questionIds)
  const graded = gradeAttempt({ questionIds, sections, answers, questionDocs })

  const now = Date.now()
  const startedMs = toMillis(data.startedAt)
  const deadlineMs = toMillis(data.deadlineAt)
  const expired = input.reason === 'expired' || now >= deadlineMs
  const status: QuizAttemptStatus = expired ? 'expired' : 'submitted'
  const endedMs = expired ? Math.min(now, deadlineMs) : now
  const durationSeconds = Math.max(0, Math.round((endedMs - startedMs) / 1_000))

  await db.runTransaction(async (transaction) => {
    const [attemptSnapshot, userSnapshot] = await Promise.all([
      transaction.get(attemptRef),
      transaction.get(userRef),
    ])
    const current = attemptSnapshot.data() ?? {}
    if (current.status !== 'in_progress') return

    transaction.update(attemptRef, {
      status,
      submittedAt: Timestamp.fromMillis(now),
      finalScore: graded.score.finalScore,
      sectionScores: graded.score.sections.reduce<Record<string, number>>((scores, section) => {
        scores[section.section] = section.score
        return scores
      }, {}),
      correctCount: graded.score.correct,
      incorrectCount: graded.score.incorrect,
      unansweredCount: graded.score.unanswered,
      durationSeconds,
      updatedAt: Timestamp.fromMillis(now),
    })

    if (userSnapshot.exists) {
      const user = userSnapshot.data() ?? {}
      const currentXp = typeof user.xp === 'number' ? user.xp : 0
      const earnedXp = xpForAttempt(graded.score.finalScore)
      const progress = applyLearningActivity(
        {
          streak: user.streak,
          lastActiveDate: user.lastActiveDate,
          totalAttempts: user.learningAttempts,
          correctAnswers: user.correctAnswers,
          achievementIds: user.achievementIds,
        },
        graded.score.finalScore >= QUIZ_PASS_MARK,
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
      db.collection(QUIZ_SESSIONS_COLLECTION).doc(input.studentId),
      { attemptId: input.attemptId, status, updatedAt: Timestamp.fromMillis(now) },
      { merge: true },
    )
  })

  const batch = db.batch()
  for (const item of graded.review) {
    batch.set(
      db.collection(QUIZ_ANSWERS_COLLECTION).doc(`${input.attemptId}_${item.questionId}`),
      {
        attemptId: input.attemptId,
        studentId: input.studentId,
        questionId: item.questionId,
        section: item.section,
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
 * Starts an exam, or resumes the one already running. A student can never hold
 * two live attempts, so refreshing or reopening the page cannot reset the clock.
 */
export async function startQuizAttempt(input: {
  studentId: string
  level: QuestionLevel
}): Promise<QuizAttemptView> {
  const db = getAdminDb()
  const sessionRef = db.collection(QUIZ_SESSIONS_COLLECTION).doc(input.studentId)

  const sessionSnapshot = await sessionRef.get()
  const pointer = sessionSnapshot.exists ? sessionSnapshot.data()?.attemptId : null
  if (typeof pointer === 'string') {
    const resumed = await getQuizAttemptState({ studentId: input.studentId, attemptId: pointer })
    if (resumed && resumed.status === 'in_progress') return resumed
  }

  const selection = await selectQuizQuestions(input.level)
  const attemptRef = db.collection(QUIZ_ATTEMPTS_COLLECTION).doc()
  const now = Date.now()
  const questionIds = selection.questions.map((question) => question.id)

  const created = await db.runTransaction(async (transaction) => {
    const currentSession = await transaction.get(sessionRef)
    const currentPointer = currentSession.exists ? currentSession.data()?.attemptId : null
    if (typeof currentPointer === 'string') {
      const liveSnapshot = await transaction.get(
        db.collection(QUIZ_ATTEMPTS_COLLECTION).doc(currentPointer),
      )
      const live = liveSnapshot.data()
      if (
        liveSnapshot.exists
        && live?.status === 'in_progress'
        && toMillis(live.deadlineAt) > now
      ) {
        return { attemptId: currentPointer, created: false }
      }
    }

    transaction.create(attemptRef, {
      studentId: input.studentId,
      level: input.level,
      status: 'in_progress',
      questionIds,
      sections: selection.sections,
      passageIds: selection.passageIds,
      answers: {},
      startedAt: Timestamp.fromMillis(now),
      deadlineAt: Timestamp.fromMillis(now + QUIZ_DURATION_MS),
      submittedAt: null,
      finalScore: null,
      sectionScores: null,
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
    return { attemptId: attemptRef.id, created: true }
  })

  const state = await getQuizAttemptState({ studentId: input.studentId, attemptId: created.attemptId })
  if (!state) throw new Error('QUIZ_ATTEMPT_NOT_FOUND')
  return state
}

/** Reads an attempt, closing it first if its server deadline has already passed. */
export async function getQuizAttemptState(input: {
  studentId: string
  attemptId: string
}): Promise<QuizAttemptView | null> {
  const db = getAdminDb()
  const attemptRef = db.collection(QUIZ_ATTEMPTS_COLLECTION).doc(input.attemptId)
  const snapshot = await attemptRef.get()
  if (!snapshot.exists) return null
  const data = snapshot.data() ?? {}
  if (data.studentId !== input.studentId) return null

  const now = Date.now()
  if (data.status === 'in_progress' && now >= toMillis(data.deadlineAt)) {
    await finalizeQuizAttempt({ studentId: input.studentId, attemptId: input.attemptId, reason: 'expired' })
    const refreshed = await attemptRef.get()
    return buildAttemptView(refreshed.id, refreshed.data() ?? {}, Date.now())
  }

  return buildAttemptView(snapshot.id, data, now)
}

export async function getActiveQuizAttempt(studentId: string): Promise<QuizAttemptView | null> {
  const db = getAdminDb()
  const sessionSnapshot = await db.collection(QUIZ_SESSIONS_COLLECTION).doc(studentId).get()
  const pointer = sessionSnapshot.exists ? sessionSnapshot.data()?.attemptId : null
  if (typeof pointer !== 'string') return null
  const state = await getQuizAttemptState({ studentId, attemptId: pointer })
  return state && state.status === 'in_progress' ? state : null
}

export async function saveQuizAnswer(input: {
  studentId: string
  attemptId: string
  questionId: string
  selectedOption: number
}): Promise<{ remainingMs: number; savedAt: string }> {
  const db = getAdminDb()
  const attemptRef = db.collection(QUIZ_ATTEMPTS_COLLECTION).doc(input.attemptId)
  const snapshot = await attemptRef.get()
  if (!snapshot.exists) throw new Error('QUIZ_ATTEMPT_NOT_FOUND')
  const data = snapshot.data() ?? {}
  if (data.studentId !== input.studentId) throw new Error('QUIZ_ATTEMPT_NOT_FOUND')
  if (data.status !== 'in_progress') throw new Error('QUIZ_ATTEMPT_FINISHED')

  const questionIds = stringList(data.questionIds)
  if (!questionIds.includes(input.questionId)) throw new Error('QUIZ_QUESTION_NOT_IN_ATTEMPT')

  const questionSnapshot = await db.collection(QUESTION_BANK_COLLECTION).doc(input.questionId).get()
  const options = stringList(questionSnapshot.data()?.options)
  if (input.selectedOption >= options.length) throw new Error('QUIZ_OPTION_OUT_OF_RANGE')

  const now = Date.now()
  if (now >= toMillis(data.deadlineAt)) {
    await finalizeQuizAttempt({ studentId: input.studentId, attemptId: input.attemptId, reason: 'expired' })
    throw new Error('QUIZ_EXPIRED')
  }

  await db.runTransaction(async (transaction) => {
    const fresh = await transaction.get(attemptRef)
    const current = fresh.data() ?? {}
    if (current.status !== 'in_progress') throw new Error('QUIZ_ATTEMPT_FINISHED')
    if (Date.now() >= toMillis(current.deadlineAt)) throw new Error('QUIZ_EXPIRED')
    transaction.update(attemptRef, {
      [`answers.${input.questionId}`]: input.selectedOption,
      updatedAt: Timestamp.fromMillis(Date.now()),
    })
  })

  return {
    remainingMs: remainingQuizMs(toMillis(data.deadlineAt), now),
    savedAt: new Date(now).toISOString(),
  }
}

export async function submitQuizAttempt(input: {
  studentId: string
  attemptId: string
}): Promise<QuizAttemptView> {
  const db = getAdminDb()
  const attemptRef = db.collection(QUIZ_ATTEMPTS_COLLECTION).doc(input.attemptId)
  const snapshot = await attemptRef.get()
  if (!snapshot.exists) throw new Error('QUIZ_ATTEMPT_NOT_FOUND')
  const data = snapshot.data() ?? {}
  if (data.studentId !== input.studentId) throw new Error('QUIZ_ATTEMPT_NOT_FOUND')

  if (data.status === 'in_progress') {
    await finalizeQuizAttempt({
      studentId: input.studentId,
      attemptId: input.attemptId,
      reason: Date.now() >= toMillis(data.deadlineAt) ? 'expired' : 'submitted',
    })
  }

  const state = await getQuizAttemptState({ studentId: input.studentId, attemptId: input.attemptId })
  if (!state) throw new Error('QUIZ_ATTEMPT_NOT_FOUND')
  return state
}

export async function listQuizAttempts(studentId: string, limit = 10): Promise<QuizAttemptSummary[]> {
  const db = getAdminDb()
  const snapshot = await db
    .collection(QUIZ_ATTEMPTS_COLLECTION)
    .where('studentId', '==', studentId)
    .limit(50)
    .get()

  return snapshot.docs
    .map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        level: (data.level === 'intermediate' || data.level === 'advanced' ? data.level : 'beginner') as QuestionLevel,
        status: (data.status === 'submitted' || data.status === 'expired' ? data.status : 'in_progress') as QuizAttemptStatus,
        startedAt: new Date(toMillis(data.startedAt)).toISOString(),
        submittedAt: data.submittedAt ? new Date(toMillis(data.submittedAt)).toISOString() : null,
        finalScore: typeof data.finalScore === 'number' ? data.finalScore : null,
        correct: typeof data.correctCount === 'number' ? data.correctCount : null,
        total: stringList(data.questionIds).length,
      }
    })
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
    .slice(0, limit)
}
