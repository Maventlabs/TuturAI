import { NextResponse } from 'next/server'
import { getAchievementProgress } from '@tuturai/domain'
import { requireRole } from '@/lib/api/auth-guard'
import { getAdminDb } from '@/lib/firebase/admin'

type Attempt = {
  id: string
  questionId?: string
  isCorrect?: boolean
  createdAt?: { toMillis?: () => number }
}

export async function GET() {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  const db = getAdminDb()
  const [userSnapshot, attemptsSnapshot] = await Promise.all([
    db.collection('users').doc(auth.user.uid).get(),
    db.collection('questionAttempts').where('studentId', '==', auth.user.uid).limit(200).get(),
  ])

  const attempts = attemptsSnapshot.docs.map((doc): Attempt => ({ id: doc.id, ...doc.data() }))
  const questionIds = [...new Set(attempts.map((attempt) => attempt.questionId).filter((id): id is string => Boolean(id)))]
  const questionSnapshots = await Promise.all(questionIds.map((id) => db.collection('questionBank').doc(id).get()))
  const skillByQuestion = new Map(questionSnapshots.map((snapshot) => [snapshot.id, snapshot.data()?.skill ?? 'unknown']))
  const correct = attempts.filter((attempt) => attempt.isCorrect === true).length
  const bySkill = new Map<string, { attempts: number; correct: number }>()

  for (const attempt of attempts) {
    const skill = skillByQuestion.get(attempt.questionId ?? '') ?? 'unknown'
    const current = bySkill.get(skill) ?? { attempts: 0, correct: 0 }
    current.attempts += 1
    if (attempt.isCorrect === true) current.correct += 1
    bySkill.set(skill, current)
  }

  const trend = [...attempts]
    .sort((left, right) => String(left.createdAt?.toMillis?.() ?? 0).localeCompare(String(right.createdAt?.toMillis?.() ?? 0)))
    .slice(-12)
    .map((attempt, index, list) => ({
      week: `A${index + 1}`,
      skor: Math.round((list.slice(0, index + 1).filter((item) => item.isCorrect === true).length / (index + 1)) * 100),
    }))

  const user = userSnapshot.data() ?? {}
  const totalAttempts = attempts.length
  const score = totalAttempts === 0 ? null : Math.round((correct / totalAttempts) * 100)
  const achievements = getAchievementProgress({
    streak: Number(user.streak ?? 0),
    lastActiveDate: typeof user.lastActiveDate === 'string' ? user.lastActiveDate : null,
    totalAttempts,
    correctAnswers: correct,
    achievementIds: Array.isArray(user.achievementIds) ? user.achievementIds : [],
  })

  return NextResponse.json({
    data: {
      profile: { xp: user.xp ?? 0, level: user.level ?? 1, streak: user.streak ?? 0 },
      summary: { totalAttempts, correct, score },
      trend,
      skills: [...bySkill.entries()].map(([skill, value]) => ({ skill, score: Math.round((value.correct / value.attempts) * 100), attempts: value.attempts })),
      achievements,
    },
  })
}
