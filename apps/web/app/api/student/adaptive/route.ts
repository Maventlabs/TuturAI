import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/auth-guard'
import { getAdminDb } from '@/lib/firebase/admin'
import { listPublishedQuestions } from '@/lib/question-bank'
import { buildAdaptivePlan } from '@/lib/adaptive'

export async function GET() {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  const db = getAdminDb()
  const [questions, attemptsSnapshot, assessmentsSnapshot, practiceSnapshot, conversationSnapshot] = await Promise.all([
    listPublishedQuestions({ limit: 100 }),
    db.collection('questionAttempts').where('studentId', '==', auth.user.uid).limit(200).get(),
    db.collection('assessments').where('studentId', '==', auth.user.uid).limit(50).get(),
    db.collection('practiceAttempts').where('studentId', '==', auth.user.uid).limit(100).get(),
    db.collection('conversationTextAttempts').where('studentId', '==', auth.user.uid).limit(100).get(),
  ])

  const attempts = attemptsSnapshot.docs.map((doc) => {
    const data = doc.data()
    return { questionId: typeof data.questionId === 'string' ? data.questionId : undefined, isCorrect: data.isCorrect === true }
  })

  const assessments = assessmentsSnapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      pronunciation: typeof data.pronunciation === 'number' ? data.pronunciation : undefined,
      fluency: typeof data.fluency === 'number' ? data.fluency : undefined,
      intonation: typeof data.intonation === 'number' ? data.intonation : undefined,
      grammar: typeof data.grammar === 'number' ? data.grammar : undefined,
      vocabulary: typeof data.vocabulary === 'number' ? data.vocabulary : undefined,
    }
  })

  const confirmedPracticeAttempts = practiceSnapshot.docs
    .map((doc) => doc.data())
    .filter((data) => data.assessmentStatus === 'completed' && typeof data.score === 'number')
    .map((data) => ({ questionId: typeof data.questionId === 'string' ? data.questionId : undefined, score: data.score as number }))

  const conversationAttempts = conversationSnapshot.docs
    .map((doc) => doc.data())
    .filter((data) => typeof data.score === 'number')
    .map((data) => ({ questionId: typeof data.questionId === 'string' ? data.questionId : undefined, score: data.score as number }))

  const assessmentAttempts = assessmentsSnapshot.docs
    .map((doc) => doc.data())
    .filter((data) => data.error === null && typeof data.overall === 'number')
    .map((data) => ({ questionId: typeof data.questionId === 'string' ? data.questionId : undefined, score: data.overall as number }))

  return NextResponse.json({ data: buildAdaptivePlan({ questions, attempts: [...attempts, ...confirmedPracticeAttempts, ...conversationAttempts, ...assessmentAttempts], assessments }) })
}
