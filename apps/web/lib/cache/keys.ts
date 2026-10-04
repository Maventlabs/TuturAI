import { buildCacheKey } from '@/lib/cache'

/**
 * TTL policy.
 *
 * These are deliberately short. A classroom roster or leaderboard that is a
 * few seconds stale is harmless, and a short TTL bounds the damage from any
 * invalidation path we ever miss. Everything here is still invalidated
 * explicitly on write — the TTL is a safety net, not the correctness mechanism.
 */
export const CACHE_TTL = {
  /** Session profile: changes only on onboarding or account edits. */
  profile: 30,
  /** Classroom lists and membership: invalidated on any classroom/membership write. */
  classrooms: 20,
  /** Roster/leaderboard views derived from membership + user XP. */
  members: 15,
  /** Assignment lists: invalidated on create/publish/attachment changes. */
  assignments: 15,
  /** Review queue: invalidated on submit and review. */
  reviewQueue: 10,
  /** Aggregate analytics: recomputed from attempts and assessments. */
  analytics: 30,
  /** Published question bank: large read, changes only on publish. */
  questionBank: 120,
} as const

export type CacheNamespace = keyof typeof CACHE_TTL

/**
 * Namespaces are the invalidation unit: `invalidateNamespaces('members')`
 * clears every roster and leaderboard entry in one scan.
 */
export const CACHE_NAMESPACES = {
  profile: (uid: string) => buildCacheKey('profile', uid),
  teacherClassrooms: (teacherId: string) => buildCacheKey('classrooms:teacher', teacherId),
  studentClassrooms: (studentId: string) => buildCacheKey('classrooms:student', studentId),
  classroomMembers: (classroomId: string) => buildCacheKey('members', classroomId),
  classroomLeaderboard: (classroomId: string) => buildCacheKey('members:leaderboard', classroomId),
  classroomAssignments: (classroomId: string) => buildCacheKey('assignments', classroomId),
  reviewQueue: (teacherId: string) => buildCacheKey('reviewQueue', teacherId),
  teacherAnalytics: (teacherId: string, period: string) => buildCacheKey('analytics', teacherId, period),
  teacherLeaderboard: (teacherId: string) => buildCacheKey('analytics:leaderboard', teacherId),
  studentDashboard: (studentId: string) => buildCacheKey('analytics:dashboard', studentId),
  learningStats: (studentId: string) => buildCacheKey('analytics:learningStats', studentId),
  publishedQuestions: (skill: string, level: string, contentType: string, limit: number) =>
    buildCacheKey('questionBank', skill, level, contentType, limit),
} as const
