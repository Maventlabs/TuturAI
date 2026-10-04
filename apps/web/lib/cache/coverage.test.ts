import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const APP_ROOT = path.resolve(__dirname, '..', '..')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (entry === 'node_modules' || entry === '.next' || entry === '.turbo') return []
    const full = path.join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.ts') || full.endsWith('.tsx') ? [full] : []
  })
}

const sources = [
  ...walk(path.join(APP_ROOT, 'lib')),
  ...walk(path.join(APP_ROOT, 'app')),
].filter((file) => !file.endsWith('.test.ts'))

function read(file: string) {
  return readFileSync(file, 'utf8')
}

/**
 * These guard the cache's correctness contract at the source level: a cached
 * read with no matching invalidation on write would serve stale data to users
 * for the life of the TTL, and no unit test of `cacheAside` can catch it.
 */
describe('cache invalidation coverage', () => {
  const allSource = sources.map(read).join('\n')

  it('every namespace built by CACHE_NAMESPACES is invalidated somewhere', () => {
    const namespaces = [
      'profile',
      'classrooms:teacher',
      'classrooms:student',
      'members',
      'members:leaderboard',
      'assignments',
      'reviewQueue',
      'analytics',
      'analytics:leaderboard',
      'analytics:dashboard',
      'analytics:learningStats',
      'questionBank',
    ]

    for (const namespace of namespaces) {
      expect(
        allSource.includes(`\`${namespace}:`) || allSource.includes(`'${namespace}`),
        `namespace "${namespace}" is written but never invalidated`,
      ).toBe(true)
    }
  })

  it('invalidates the teacher classroom list when a classroom is created', () => {
    const classrooms = read(path.join(APP_ROOT, 'lib', 'classrooms.ts'))
    const create = classrooms.slice(classrooms.indexOf('export async function createTeacherClassroom'))
    expect(create).toContain('classrooms:teacher:${teacherId}')
  })

  it('invalidates the student classroom list and roster when a student joins', () => {
    const join = read(path.join(APP_ROOT, 'app', 'api', 'classrooms', 'join', 'route.ts'))
    expect(join).toContain('classrooms:student:')
    expect(join).toContain('members:leaderboard:')
  })

  it('invalidates the profile on onboarding so a new user is not stuck as missing', () => {
    expect(read(path.join(APP_ROOT, 'lib', 'firebase', 'onboarding.ts'))).toContain('profile:${uid}')
  })

  it('invalidates the profile and student aggregates after answering a question', () => {
    const bank = read(path.join(APP_ROOT, 'lib', 'question-bank.ts'))
    const answer = bank.slice(bank.indexOf('export async function answerQuestion'))
    expect(answer).toContain('profile:${input.studentId}')
    expect(answer).toContain('analytics:dashboard:${input.studentId}')
    expect(answer).toContain('analytics:learningStats:${input.studentId}')
  })

  it('invalidates the review queue after a submission is reviewed', () => {
    const submissions = read(path.join(APP_ROOT, 'lib', 'submissions.ts'))
    const review = submissions.slice(submissions.indexOf('export async function reviewSubmission'))
    expect(review).toContain('reviewQueue:${teacherId}')
  })

  it('scopes cached assignment lists by role so students never see drafts', () => {
    const assignments = read(path.join(APP_ROOT, 'lib', 'assignments.ts'))
    const list = assignments.slice(assignments.indexOf('export async function listClassroomAssignments'))
    // The role must be part of the cache key, not just the post-filter.
    expect(list).toContain('${actor.role}')
    expect(list).toContain("assignment.status === 'published'")
  })

  it('keeps authorization checks outside the cached loader', () => {
    const classrooms = read(path.join(APP_ROOT, 'lib', 'classrooms.ts'))

    // Roster: the ownership check must run on every request, before the cache.
    const members = classrooms.slice(classrooms.indexOf('export async function listTeacherClassroomMembers'))
    const membersCheck = members.indexOf('teacherId !== teacherId')
    const membersCache = members.indexOf('cacheAside')
    expect(membersCheck).toBeGreaterThan(-1)
    expect(membersCache).toBeGreaterThan(membersCheck)

    // Leaderboard: membership gates the read.
    const leaderboard = classrooms.slice(classrooms.indexOf('export async function listClassroomLeaderboard'))
    const lbCheck = leaderboard.indexOf("status !== 'active'")
    const lbCache = leaderboard.indexOf('cacheAside')
    expect(lbCheck).toBeGreaterThan(-1)
    expect(lbCache).toBeGreaterThan(lbCheck)
  })

  it('does not cache the session cookie verification itself', () => {
    const session = read(path.join(APP_ROOT, 'lib', 'firebase', 'session.ts'))
    const verify = session.slice(session.indexOf('export async function verifySessionCookie'))
    const verifyBody = verify.slice(0, verify.indexOf('export async function readProfileDocument'))
    expect(verifyBody).not.toContain('cacheAside')
    // Only the profile document read is cached; revocation must stay live.
    expect(session).toContain('getAdminAuth().verifySessionCookie(sessionCookie, true)')
  })

  it('never disables the cache in production by default', () => {
    const env = read(path.join(APP_ROOT, 'lib', 'config', 'redis-env.ts'))
    // Only an explicit CACHE_ENABLED=false may switch it off.
    expect(env).toContain("optional('CACHE_ENABLED') === 'false'")
    expect(env).not.toContain("NODE_ENV === 'production' && !")
  })
})
