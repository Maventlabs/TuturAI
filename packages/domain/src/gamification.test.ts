import { describe, expect, it } from 'vitest'
import { applyLearningActivity, getAchievementProgress } from './gamification'

describe('applyLearningActivity', () => {
  it('starts a streak and unlocks the first activity achievement', () => {
    const progress = applyLearningActivity(undefined, true, new Date('2026-09-22T08:00:00.000Z'))

    expect(progress).toMatchObject({
      streak: 1,
      lastActiveDate: '2026-09-22',
      totalAttempts: 1,
      correctAnswers: 1,
      achievementIds: ['first-step'],
    })
  })

  it('increments once per new day and resets after a missed day', () => {
    const first = applyLearningActivity(undefined, false, new Date('2026-09-20T08:00:00.000Z'))
    const second = applyLearningActivity(first, true, new Date('2026-09-21T08:00:00.000Z'))
    const duplicateDay = applyLearningActivity(second, true, new Date('2026-09-21T12:00:00.000Z'))
    const reset = applyLearningActivity(duplicateDay, true, new Date('2026-09-23T08:00:00.000Z'))

    expect(second.streak).toBe(2)
    expect(duplicateDay.streak).toBe(2)
    expect(duplicateDay.totalAttempts).toBe(3)
    expect(reset.streak).toBe(1)
  })

  it('reports durable achievement progress from server-owned counters', () => {
    const achievements = getAchievementProgress({
      streak: 7,
      lastActiveDate: '2026-09-22',
      totalAttempts: 25,
      correctAnswers: 10,
      achievementIds: [],
    })

    expect(achievements.filter((achievement) => achievement.unlocked).map((achievement) => achievement.id)).toEqual([
      'first-step',
      'accurate',
      'consistent',
      'scholar',
    ])
  })
})
