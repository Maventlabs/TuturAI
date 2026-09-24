import type { QuestionBankItem } from '@tuturai/domain'

export type AdaptiveActivityStatus = 'recommended' | 'available' | 'completed'

export interface AdaptiveAttempt {
  questionId?: string
  isCorrect?: boolean
  score?: number
}

export interface AdaptiveAssessment {
  pronunciation?: number
  fluency?: number
  intonation?: number
  grammar?: number
  vocabulary?: number
}

export interface AdaptiveActivity {
  id: string
  title: string
  description: string
  skill: QuestionBankItem['skill']
  level: QuestionBankItem['level']
  contentType: QuestionBankItem['contentType']
  status: AdaptiveActivityStatus
  attempts: number
  score: number | null
}

export interface AdaptivePlan {
  activities: AdaptiveActivity[]
  recommendation: AdaptiveActivity | null
  reason: string
}

function focusSkillFromAssessments(assessments: AdaptiveAssessment[]) {
  const dimensions = ['pronunciation', 'fluency', 'intonation', 'grammar', 'vocabulary'] as const
  const averages = dimensions
    .map((dimension) => {
      const values = assessments
        .map((assessment) => assessment[dimension])
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      return { dimension, score: values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null }
    })
    .filter((entry): entry is { dimension: (typeof dimensions)[number]; score: number } => entry.score !== null)
    .sort((left, right) => left.score - right.score)
    .at(0)

  if (!averages) return null
  return averages.dimension === 'grammar' || averages.dimension === 'vocabulary' ? averages.dimension : averages.dimension === 'pronunciation' ? 'pronunciation' : 'speaking'
}

export function buildAdaptivePlan(input: { questions: QuestionBankItem[]; attempts: AdaptiveAttempt[]; assessments?: AdaptiveAssessment[] }): AdaptivePlan {
  const attemptsByQuestion = new Map<string, AdaptiveAttempt[]>()
  const focusSkill = focusSkillFromAssessments(input.assessments ?? [])

  for (const attempt of input.attempts) {
    if (!attempt.questionId || (attempt.isCorrect !== true && attempt.isCorrect !== false && typeof attempt.score !== 'number')) continue
    const attempts = attemptsByQuestion.get(attempt.questionId) ?? []
    attempts.push(attempt)
    attemptsByQuestion.set(attempt.questionId, attempts)
  }

  const activities = input.questions.map((question): AdaptiveActivity => {
    const attempts = attemptsByQuestion.get(question.id) ?? []
    const confirmed = attempts.filter((attempt) => attempt.isCorrect === true || typeof attempt.score === 'number')
    const scored = attempts.map((attempt) => attempt.score).filter((score): score is number => typeof score === 'number' && Number.isFinite(score))
    const correct = attempts.filter((attempt) => attempt.isCorrect === true).length

    return {
      id: question.id,
      title: question.word ?? question.tags[0] ?? question.prompt.slice(0, 48),
      description: question.prompt,
      skill: question.skill,
      level: question.level,
      contentType: question.contentType,
      status: confirmed.length > 0 ? 'completed' : 'available',
      attempts: attempts.length,
      score: scored.length > 0
        ? Math.round(scored.reduce((sum, score) => sum + score, 0) / scored.length)
        : attempts.length > 0 ? Math.round((correct / attempts.length) * 100) : null,
    }
  })

  const recommendation = activities.some((activity) => activity.status !== 'completed')
    ? [...activities]
    .sort((left, right) => {
      if (focusSkill && left.skill === focusSkill && right.skill !== focusSkill) return -1
      if (focusSkill && left.skill !== focusSkill && right.skill === focusSkill) return 1
      if (left.score === null && right.score !== null) return -1
      if (left.score !== null && right.score === null) return 1
      return (left.score ?? 0) - (right.score ?? 0)
    })
      .find((activity) => activity.status !== 'completed') ?? null
    : null

  if (!recommendation) {
    return {
      activities,
      recommendation: null,
      reason: activities.length > 0 ? 'Semua materi adaptive yang tersedia sudah selesai.' : 'Belum ada materi adaptive yang dipublikasikan.',
    }
  }

  recommendation.status = 'recommended'
  return {
    activities,
    recommendation,
    reason: focusSkill
      ? `Materi ini diprioritaskan untuk skill ${focusSkill} berdasarkan dimensi terlemah dari riwayat assessment.`
      : recommendation.score === null
        ? 'Mulai dari materi ini untuk membangun baseline belajar.'
        : `Materi ini dipilih karena skor latihan tersimpanmu masih ${recommendation.score}%.`,
  }
}
