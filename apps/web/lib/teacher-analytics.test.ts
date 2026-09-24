import { describe, expect, it } from 'vitest'
import { buildTeacherAnalytics } from './teacher-analytics'

describe('buildTeacherAnalytics', () => {
  it('aggregates durable practice attempts by skill and classroom', () => {
    const result = buildTeacherAnalytics({
      classrooms: [{ id: 'class-1', name: 'XI IPA', studentCount: 2 }],
      attempts: [
        { studentId: 'student-1', skill: 'grammar', isCorrect: true, createdAt: '2026-09-01T00:00:00.000Z' },
        { studentId: 'student-2', skill: 'grammar', isCorrect: false, createdAt: '2026-09-02T00:00:00.000Z' },
      ],
      assessments: [],
    })

    expect(result.summary).toMatchObject({ classroomCount: 1, studentCount: 2, practiceAttempts: 2, practiceAccuracy: 50, averageSpeakingScore: null })
    expect(result.skills).toEqual([{ skill: 'grammar', score: 50, attempts: 2 }])
    expect(result.speaking).toEqual({ available: false, assessmentCount: 0 })
  })

  it('uses only valid speaking scores and keeps empty trend explicit', () => {
    const result = buildTeacherAnalytics({
      classrooms: [],
      attempts: [],
      assessments: [{ studentId: 'student-1', overall: 80 }, { studentId: 'student-2', overall: 100 }, { studentId: 'student-3', overall: 999 }],
    })

    expect(result.summary.averageSpeakingScore).toBe(90)
    expect(result.speaking).toEqual({ available: true, assessmentCount: 2 })
    expect(result.trend).toEqual([])
  })

  it('filters by period and exposes common errors plus attention students', () => {
    const result = buildTeacherAnalytics({
      classrooms: [{ id: 'class-1', name: 'XI IPA', studentCount: 2 }],
      attempts: [
        { studentId: 'student-1', skill: 'grammar', isCorrect: false, createdAt: '2026-09-20T00:00:00.000Z' },
        { studentId: 'student-1', skill: 'grammar', isCorrect: false, createdAt: '2026-09-01T00:00:00.000Z' },
        { studentId: 'student-2', skill: 'vocabulary', isCorrect: true, createdAt: '2026-09-21T00:00:00.000Z' },
      ],
      assessments: [{ studentId: 'student-1', overall: 45, createdAt: '2026-09-20T00:00:00.000Z' }],
      period: '7d',
      now: Date.parse('2026-09-23T00:00:00.000Z'),
    })

    expect(result.period).toBe('7d')
    expect(result.summary.practiceAttempts).toBe(2)
    expect(result.commonErrors[0]).toMatchObject({ skill: 'grammar', errors: 1 })
    expect(result.attention).toEqual([expect.objectContaining({ studentId: 'student-1', averageSpeakingScore: 45 })])
  })
})
