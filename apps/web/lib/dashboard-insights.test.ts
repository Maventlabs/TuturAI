import { describe, expect, it } from 'vitest'
import { buildDashboardInsights } from './dashboard-insights'

describe('buildDashboardInsights', () => {
  it('counts only current UTC-week attempts toward the weekly target', () => {
    const insights = buildDashboardInsights([
      { id: 'old', questionId: 'q-old', isCorrect: true, createdAt: '2026-09-14T09:00:00.000Z' },
      { id: 'current', questionId: 'q-current', isCorrect: false, createdAt: '2026-09-22T09:00:00.000Z' },
    ], new Date('2026-09-22T12:00:00.000Z'))

    expect(insights.weeklyTarget).toEqual({ completed: 1, target: 5 })
    expect(insights.totalAttempts).toBe(2)
  })

  it('returns latest activity first without inventing a score', () => {
    const insights = buildDashboardInsights([
      { id: 'first', questionId: 'q-1', isCorrect: true, createdAt: '2026-09-21T09:00:00.000Z' },
      { id: 'second', questionId: 'q-2', isCorrect: false, createdAt: '2026-09-22T09:00:00.000Z' },
    ], new Date('2026-09-22T12:00:00.000Z'))

    expect(insights.recentActivity).toEqual([
      { id: 'second', questionId: 'q-2', isCorrect: false, createdAt: '2026-09-22T09:00:00.000Z' },
      { id: 'first', questionId: 'q-1', isCorrect: true, createdAt: '2026-09-21T09:00:00.000Z' },
    ])
  })
})
