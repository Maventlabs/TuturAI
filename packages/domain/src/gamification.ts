export type AchievementProgress = {
  id: string
  title: string
  desc: string
  category: string
  icon: string
  target: number
  progress: number
  unlocked: boolean
}

export type LearningProgress = {
  streak: number
  lastActiveDate: string | null
  totalAttempts: number
  correctAnswers: number
  achievementIds: string[]
}

function utcDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function daysBetween(previous: string, current: string) {
  const previousTime = Date.parse(`${previous}T00:00:00.000Z`)
  const currentTime = Date.parse(`${current}T00:00:00.000Z`)
  return Math.round((currentTime - previousTime) / 86_400_000)
}

export function getAchievementProgress(progress: LearningProgress): AchievementProgress[] {
  const definitions = [
    { id: 'first-step', title: 'Langkah Pertama', desc: 'Selesaikan latihan pertama.', category: 'Speaking', icon: 'Footprints', target: 1, value: progress.totalAttempts },
    { id: 'accurate', title: 'Akurat', desc: 'Jawab benar 10 soal.', category: 'Vocabulary', icon: 'Target', target: 10, value: progress.correctAnswers },
    { id: 'consistent', title: 'Konsisten', desc: 'Bangun streak belajar 7 hari.', category: 'Streak', icon: 'Flame', target: 7, value: progress.streak },
    { id: 'scholar', title: 'Pembelajar Aktif', desc: 'Selesaikan 25 latihan.', category: 'Listening', icon: 'BookOpen', target: 25, value: progress.totalAttempts },
  ]

  return definitions.map((definition) => ({
    id: definition.id,
    title: definition.title,
    desc: definition.desc,
    category: definition.category,
    icon: definition.icon,
    target: definition.target,
    progress: Math.min(definition.value, definition.target) / definition.target * 100,
    unlocked: definition.value >= definition.target || progress.achievementIds.includes(definition.id),
  }))
}

export function applyLearningActivity(
  current: Partial<LearningProgress> | undefined,
  isCorrect: boolean,
  now = new Date(),
): LearningProgress {
  const today = utcDateKey(now)
  const previousDate = typeof current?.lastActiveDate === 'string' ? current.lastActiveDate : null
  const previousStreakValue = current?.streak
  const previousStreak = Number.isInteger(previousStreakValue) ? Math.max(0, previousStreakValue as number) : 0
  const streak = previousDate === today
    ? previousStreak
    : previousDate && daysBetween(previousDate, today) === 1
      ? previousStreak + 1
      : 1
  const next: LearningProgress = {
    streak,
    lastActiveDate: today,
    totalAttempts: Math.max(0, Number(current?.totalAttempts ?? 0)) + 1,
    correctAnswers: Math.max(0, Number(current?.correctAnswers ?? 0)) + (isCorrect ? 1 : 0),
    achievementIds: Array.isArray(current?.achievementIds) ? current.achievementIds.filter((id): id is string => typeof id === 'string') : [],
  }

  const unlocked = getAchievementProgress(next).filter((achievement) => achievement.unlocked).map((achievement) => achievement.id)
  return { ...next, achievementIds: [...new Set([...next.achievementIds, ...unlocked])] }
}
