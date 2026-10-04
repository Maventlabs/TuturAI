import { FieldValue, Timestamp, type DocumentData } from 'firebase-admin/firestore'
import { applyLearningActivity, isAnswerableContentType, type LearningContentType, type QuestionBankItem, type QuestionLevel, type QuestionSkill } from '@tuturai/domain'
import { getAdminDb } from '@/lib/firebase/admin'
import { cacheAside, invalidateNamespaces } from '@/lib/cache'
import { CACHE_NAMESPACES, CACHE_TTL } from '@/lib/cache/keys'

export const QUESTION_BANK_COLLECTION = 'questionBank'
export const QUESTION_ATTEMPTS_COLLECTION = 'questionAttempts'

export function masteredQuestionIds(
  questionIds: string[],
  attempts: Array<{ questionId?: unknown; isCorrect?: unknown }>,
) {
  const requested = new Set(questionIds)
  const mastered = new Set(
    attempts
      .filter((attempt) => attempt.isCorrect === true && typeof attempt.questionId === 'string' && requested.has(attempt.questionId))
      .map((attempt) => attempt.questionId as string),
  )

  return questionIds.filter((questionId) => mastered.has(questionId))
}

function questionFromData(id: string, data: DocumentData): QuestionBankItem {
  return {
    id,
    contentType: data.contentType ?? 'question',
    skill: data.skill,
    level: data.level,
    prompt: data.prompt,
    options: Array.isArray(data.options) ? data.options : [],
    explanation: data.explanation ?? '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    word: typeof data.word === 'string' ? data.word : undefined,
    meaning: typeof data.meaning === 'string' ? data.meaning : undefined,
    example: typeof data.example === 'string' ? data.example : undefined,
    ipa: typeof data.ipa === 'string' ? data.ipa : undefined,
    tip: typeof data.tip === 'string' ? data.tip : undefined,
    audioText: typeof data.audioText === 'string' ? data.audioText : undefined,
  }
}

export async function listPublishedQuestions(filters: {
  skill?: QuestionSkill
  level?: QuestionLevel
  contentType?: LearningContentType
  limit: number
}) {
  const { value } = await cacheAside({
    key: CACHE_NAMESPACES.publishedQuestions(
      filters.skill ?? 'any',
      filters.level ?? 'any',
      filters.contentType ?? 'any',
      filters.limit,
    ),
    ttlSeconds: CACHE_TTL.questionBank,
    loader: async () => {
      const snapshot = await getAdminDb()
        .collection(QUESTION_BANK_COLLECTION)
        .where('status', '==', 'published')
        // Filter after reading a bounded bank window; a small pre-filter limit can
        // hide later content types as the published bank grows.
        .limit(1000)
        .get()

      return snapshot.docs
        .map((doc) => questionFromData(doc.id, doc.data()))
        .filter((question) => (!filters.skill || question.skill === filters.skill)
          && (!filters.level || question.level === filters.level)
          && (!filters.contentType || question.contentType === filters.contentType))
        .slice(0, filters.limit)
    },
  })
  return value
}

export async function listStudentMasteredQuestionIds(studentId: string, questionIds: string[]) {
  if (questionIds.length === 0) return []

  const snapshot = await getAdminDb()
    .collection(QUESTION_ATTEMPTS_COLLECTION)
    .where('studentId', '==', studentId)
    .limit(200)
    .get()

  return masteredQuestionIds(questionIds, snapshot.docs.map((doc) => doc.data()))
}

export async function answerQuestion(input: {
  studentId: string
  questionId: string
  selectedOption: number
  attemptId: string
  /** Optional classroom scope so leaderboard caches for it can be dropped. */
  classroomId?: string
}) {
  const db = getAdminDb()
  const attemptReference = db.collection(QUESTION_ATTEMPTS_COLLECTION).doc(`${input.studentId}_${input.attemptId}`)
  const questionReference = db.collection(QUESTION_BANK_COLLECTION).doc(input.questionId)
  const userReference = db.collection('users').doc(input.studentId)

  return db.runTransaction(async (transaction) => {
    const [attemptSnapshot, questionSnapshot, userSnapshot] = await Promise.all([
      transaction.get(attemptReference),
      transaction.get(questionReference),
      transaction.get(userReference),
    ])

    if (attemptSnapshot.exists) return attemptSnapshot.data()
    if (!questionSnapshot.exists || questionSnapshot.data()?.status !== 'published') throw new Error('QUESTION_NOT_FOUND')
    if (!userSnapshot.exists) throw new Error('USER_NOT_FOUND')

    const question = questionSnapshot.data() ?? {}
    const contentType = typeof question.contentType === 'string' ? question.contentType as LearningContentType : 'question'
    if (!isAnswerableContentType(contentType)) throw new Error('QUESTION_TYPE_NOT_ANSWERABLE')
    const correctOption = typeof question.correctOption === 'number' ? question.correctOption : -1
    const isCorrect = input.selectedOption === correctOption
    const currentUser = userSnapshot.data() ?? {}
    const currentXp = typeof currentUser.xp === 'number' ? currentUser.xp : 0
    const nextXp = currentXp + (isCorrect ? 20 : 0)
    const nextLevel = Math.max(1, Math.floor(nextXp / 100) + 1)
    const learningProgress = applyLearningActivity({
      streak: currentUser.streak,
      lastActiveDate: currentUser.lastActiveDate,
      totalAttempts: currentUser.learningAttempts,
      correctAnswers: currentUser.correctAnswers,
      achievementIds: currentUser.achievementIds,
    }, isCorrect)
    const result = {
      studentId: input.studentId,
      questionId: input.questionId,
      selectedOption: input.selectedOption,
      isCorrect,
      correctOption,
      explanation: question.explanation ?? '',
      createdAt: Timestamp.now(),
    }

    transaction.create(attemptReference, result)
    transaction.update(userReference, {
      xp: isCorrect ? FieldValue.increment(20) : currentXp,
      level: nextLevel,
      streak: learningProgress.streak,
      lastActiveDate: learningProgress.lastActiveDate,
      learningAttempts: learningProgress.totalAttempts,
      correctAnswers: learningProgress.correctAnswers,
      achievementIds: learningProgress.achievementIds,
      updatedAt: Timestamp.now(),
    })
    return result
  }).then(async (result) => {
    // Answering changes XP, streak, level, and the attempt history that every
    // dashboard view derives from, so drop the student's aggregates plus the
    // cached profile document that now holds stale XP.
    await invalidateNamespaces(
      `profile:${input.studentId}`,
      `analytics:dashboard:${input.studentId}`,
      `analytics:learningStats:${input.studentId}`,
      // Only when the caller told us which classroom this answers for.
      // Interpolating an empty id here would broaden the scan to every
      // leaderboard in the keyspace.
      ...(input.classroomId ? [`members:leaderboard:${input.classroomId}`] : []),
    )
    return result
  })
}
