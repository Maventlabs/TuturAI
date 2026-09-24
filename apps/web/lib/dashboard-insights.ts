export type DashboardAttempt = {
  id: string
  questionId?: string
  isCorrect?: boolean
  createdAt?: string
}

export function buildDashboardInsights(attempts: DashboardAttempt[], now = new Date()) {
  const weekStart = new Date(now)
  const day = weekStart.getUTCDay()
  const daysSinceMonday = day === 0 ? 6 : day - 1
  weekStart.setUTCDate(weekStart.getUTCDate() - daysSinceMonday)
  weekStart.setUTCHours(0, 0, 0, 0)

  const ordered = [...attempts].sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''))
  const completedThisWeek = attempts.filter((attempt) => attempt.createdAt && new Date(attempt.createdAt) >= weekStart).length

  return {
    totalAttempts: attempts.length,
    weeklyTarget: { completed: completedThisWeek, target: 5 },
    recentActivity: ordered.slice(0, 5),
  }
}
