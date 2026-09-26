export type AnalyticsClassroom = { id: string; name: string; studentCount: number }
export type AnalyticsAttempt = { studentId: string; isCorrect?: boolean; createdAt?: string | number; skill?: string }
export type AnalyticsAssessment = { studentId: string; overall?: number; fluency?: number; createdAt?: string | number }
export type AnalyticsPeriod = '7d' | '30d' | 'all'

function timestamp(value: string | number | undefined) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Date.parse(value) || 0
  return 0
}

export function buildTeacherAnalytics(input: {
  classrooms: AnalyticsClassroom[]
  attempts: AnalyticsAttempt[]
  assessments: AnalyticsAssessment[]
  period?: AnalyticsPeriod
  now?: number
}) {
  const period = input.period ?? 'all'
  const now = input.now ?? Date.now()
  const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : null
  const cutoff = periodDays === null ? null : now - periodDays * 24 * 60 * 60 * 1000
  const inPeriod = (createdAt: string | number | undefined) => cutoff === null || timestamp(createdAt) >= cutoff
  const attempts = input.attempts.filter((attempt) => inPeriod(attempt.createdAt))
  const assessments = input.assessments.filter((assessment) => inPeriod(assessment.createdAt))
  const correct = attempts.filter((attempt) => attempt.isCorrect === true).length
  const assessedScores = assessments
    .map((assessment) => assessment.overall)
    .filter((score): score is number => typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100)
  const fluencyScores = assessments
    .map((assessment) => assessment.fluency)
    .filter((score): score is number => typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100)
  const bySkill = new Map<string, { attempts: number; correct: number; errors: number }>()
  for (const attempt of attempts) {
    const skill = attempt.skill ?? 'unknown'
    const current = bySkill.get(skill) ?? { attempts: 0, correct: 0, errors: 0 }
    current.attempts += 1
    if (attempt.isCorrect === true) current.correct += 1
    else current.errors += 1
    bySkill.set(skill, current)
  }

  const recent = [...attempts]
    .sort((left, right) => timestamp(left.createdAt) - timestamp(right.createdAt))
    .slice(-12)
  const trend = recent.map((attempt, index, list) => ({
    label: `A${index + 1}`,
    score: Math.round((list.slice(0, index + 1).filter((item) => item.isCorrect === true).length / (index + 1)) * 100),
  }))

  return {
    summary: {
      classroomCount: input.classrooms.length,
      studentCount: input.classrooms.reduce((total, classroom) => total + classroom.studentCount, 0),
      practiceAttempts: attempts.length,
      practiceAccuracy: attempts.length ? Math.round((correct / attempts.length) * 100) : null,
      averageSpeakingScore: assessedScores.length ? Math.round(assessedScores.reduce((total, score) => total + score, 0) / assessedScores.length) : null,
    },
    period,
    trend,
    skills: [...bySkill.entries()].map(([skill, value]) => ({
      skill,
      score: Math.round((value.correct / value.attempts) * 100),
      attempts: value.attempts,
    })).sort((left, right) => right.attempts - left.attempts),
    commonErrors: [...bySkill.entries()]
      .filter(([, value]) => value.errors > 0)
      .map(([skill, value]) => ({ skill, errors: value.errors, attempts: value.attempts }))
      .sort((left, right) => right.errors - left.errors),
    fluencyDistribution: [
      { label: '0-59', count: fluencyScores.filter((score) => score < 60).length },
      { label: '60-79', count: fluencyScores.filter((score) => score >= 60 && score < 80).length },
      { label: '80-100', count: fluencyScores.filter((score) => score >= 80).length },
    ],
    classrooms: input.classrooms,
    speaking: {
      available: assessedScores.length > 0,
      assessmentCount: assessedScores.length,
    },
    attention: buildAttentionList({ attempts, assessments }),
  }
}

function buildAttentionList(input: { attempts: AnalyticsAttempt[]; assessments: AnalyticsAssessment[] }) {
  const byStudent = new Map<string, { attempts: number; correct: number; scores: number[] }>()
  for (const attempt of input.attempts) {
    const current = byStudent.get(attempt.studentId) ?? { attempts: 0, correct: 0, scores: [] }
    current.attempts += 1
    if (attempt.isCorrect === true) current.correct += 1
    byStudent.set(attempt.studentId, current)
  }
  for (const assessment of input.assessments) {
    if (typeof assessment.overall !== 'number' || !Number.isFinite(assessment.overall) || assessment.overall < 0 || assessment.overall > 100) continue
    const current = byStudent.get(assessment.studentId) ?? { attempts: 0, correct: 0, scores: [] }
    current.scores.push(assessment.overall)
    byStudent.set(assessment.studentId, current)
  }

  return [...byStudent.entries()]
    .map(([studentId, value]) => {
      const accuracy = value.attempts ? Math.round((value.correct / value.attempts) * 100) : null
      const averageSpeakingScore = value.scores.length ? Math.round(value.scores.reduce((total, score) => total + score, 0) / value.scores.length) : null
      const reasons = [
        accuracy !== null && accuracy < 60 ? 'akurasi latihan di bawah 60%' : null,
        averageSpeakingScore !== null && averageSpeakingScore < 60 ? 'rata-rata speaking di bawah 60' : null,
      ].filter((reason): reason is string => reason !== null)
      return { studentId, accuracy, averageSpeakingScore, reason: reasons.join(' dan ') }
    })
    .filter((student) => student.reason.length > 0)
    .sort((left, right) => (left.accuracy ?? 101) - (right.accuracy ?? 101))
}
