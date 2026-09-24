import { describe, expect, it } from 'vitest'
import { buildTeacherLeaderboard } from './teacher-leaderboard'

describe('buildTeacherLeaderboard', () => {
  it('ranks students by durable XP and keeps speaking unavailable explicit', () => {
    const result = buildTeacherLeaderboard([
      { studentId: 'student-2', name: 'Budi', classId: 'class-1', className: 'XI IPA', xp: 40, speakingScore: null },
      { studentId: 'student-1', name: 'Ani', classId: 'class-1', className: 'XI IPA', xp: 80, speakingScore: 76 },
    ])

    expect(result).toEqual([
      { studentId: 'student-1', name: 'Ani', classId: 'class-1', className: 'XI IPA', xp: 80, speakingScore: 76, rank: 1 },
      { studentId: 'student-2', name: 'Budi', classId: 'class-1', className: 'XI IPA', xp: 40, speakingScore: null, rank: 2 },
    ])
  })
})
