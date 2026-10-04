import { it } from 'vitest'
import { setRedisClientForTests } from '@/lib/cache/redis'
import { cacheAside, invalidateNamespaces, resetInFlightForTests } from '@/lib/cache'
import { CACHE_NAMESPACES } from '@/lib/cache/keys'
import { listClassroomLeaderboard, listStudentClassrooms, listTeacherClassroomMembers, listTeacherClassrooms } from '@/lib/classrooms'
import { listTeacherReviewQueue } from '@/lib/submissions'
import { listPublishedQuestions } from '@/lib/question-bank'

/** Median latency of one Upstash REST round trip from the Netlify region. */
const UPSTASH_REST_ROUND_TRIP_MS = 35

class SimulatedUpstash {
  store = new Map<string, string>()
  getCalls = 0
  delCalls = 0

  async get(key: string) {
    this.getCalls += 1
    await sleep(UPSTASH_REST_ROUND_TRIP_MS)
    const raw = this.store.get(key)
    return raw === undefined ? null : raw
  }

  async set(key: string, value: string) {
    this.store.set(key, value)
    await sleep(UPSTASH_REST_ROUND_TRIP_MS)
    return 'OK'
  }

  async del(...keys: string[]) {
    this.delCalls += 1
    let removed = 0
    for (const key of keys) if (this.store.delete(key)) removed += 1
    await sleep(UPSTASH_REST_ROUND_TRIP_MS)
    return removed
  }

  async scan(cursor: string | number, opts?: { match?: string }) {
    await sleep(UPSTASH_REST_ROUND_TRIP_MS)
    const pattern = new RegExp(`^${(opts?.match ?? '*').replaceAll('*', '.*')}$`)
    const keys = [...this.store.keys()].filter((key) => pattern.test(key))
    return ['0', keys] as [string, string[]]
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function measure(run: () => Promise<unknown>, samples: number) {
  const durations: number[] = []
  for (let i = 0; i < samples; i += 1) {
    const startedAt = performance.now()
    await run()
    durations.push(performance.now() - startedAt)
  }
  durations.sort((left, right) => left - right)
  return {
    medianMs: Math.round(durations[Math.floor(durations.length / 2)]),
    minMs: Math.round(durations[0]),
    maxMs: Math.round(durations.at(-1) ?? 0),
  }
}

/**
 * Measures the cache's real effect against production Firestore.
 *
 * Excluded from the default vitest run (see vitest.config.ts) because it
 * performs live production reads. Run it deliberately with `pnpm cache:bench`.
 *
 * No Upstash credential lives in the repository, so the cache layer is driven
 * through an in-process stand-in that reproduces Upstash's wire contract: one
 * REST round trip per read, and a `[cursor, keys]` tuple on SCAN. The miss
 * figure below is therefore real production Firestore latency; the hit figure
 * is what the cache will cost once a real database is connected.
 */
it('reports cache hit vs miss latency', async () => {
  const teacherId = process.env.BENCH_TEACHER_ID
  const studentId = process.env.BENCH_STUDENT_ID
  const classroomId = process.env.BENCH_CLASSROOM_ID

  const scenarios: Array<{ label: string; namespaces: string[]; run: () => Promise<unknown> }> = [
    {
      label: 'questionBank (shared by every student)',
      namespaces: ['questionBank'],
      run: () => listPublishedQuestions({ limit: 10 }),
    },
  ]

  if (teacherId) {
    scenarios.push({
      label: 'teacherClassrooms',
      namespaces: ['classrooms:teacher'],
      run: () => listTeacherClassrooms(teacherId),
    })
  }
  if (studentId) {
    scenarios.push({
      label: 'studentClassrooms',
      namespaces: ['classrooms:student'],
      run: () => listStudentClassrooms(studentId),
    })
  }
  if (classroomId && studentId) {
    scenarios.push({
      label: 'classroomLeaderboard',
      namespaces: ['members:leaderboard'],
      run: () => listClassroomLeaderboard(classroomId, studentId),
    })
  }
  if (teacherId) {
    scenarios.push({
      label: 'reviewQueue (teacher grading queue)',
      namespaces: ['reviewQueue'],
      run: () => listTeacherReviewQueue(teacherId),
    })
    scenarios.push({
      label: 'teacherClassroomMembers (roster + per-student assessments)',
      namespaces: ['members'],
      run: async () => {
        const classrooms = await listTeacherClassrooms(teacherId)
        const results = await Promise.all(classrooms.map((classroom) => listTeacherClassroomMembers(classroom.id, teacherId)))
        return results.flat()
      },
    })
  }

  if (scenarios.length === 1 && !teacherId && !studentId) {
    console.log('\nNo BENCH_* ids supplied: measuring the shared question-bank read only.')
    console.log('Set BENCH_TEACHER_ID / BENCH_STUDENT_ID / BENCH_CLASSROOM_ID for per-user reads.\n')
  }

  console.log('\nCache benchmark — origin = production Firestore, cache = simulated Upstash REST')

  for (const scenario of scenarios) {
    resetInFlightForTests()
    setRedisClientForTests(new SimulatedUpstash() as never)

    // Cold: nothing cached, so every call pays the full Firestore cost.
    const cold = await measure(scenario.run, 3)
    // Warm: entries are cached, so a call costs one REST GET.
    const warm = await measure(scenario.run, 7)

    console.log(`\n${scenario.label}`)
    console.log(`  cache miss (Firestore)  : ${cold.medianMs} ms  (min ${cold.minMs}, max ${cold.maxMs})`)
    console.log(`  cache hit   (Redis)     : ${warm.medianMs} ms  (min ${warm.minMs}, max ${warm.maxMs})`)
    console.log(`  speedup                 : ${(cold.medianMs / Math.max(warm.medianMs, 0.01)).toFixed(1)}x`)

    // Invalidation must push the next read back to the origin, or a write
    // would never become visible.
    await invalidateNamespaces(...scenario.namespaces)
    const afterInvalidation = await measure(scenario.run, 2)
    console.log(`  after invalidation      : ${afterInvalidation.medianMs} ms (should return to the miss figure)`)
  }

  setRedisClientForTests(null)

  // Isolated overhead of one cached read, with no Firestore in the path.
  setRedisClientForTests(new SimulatedUpstash() as never)
  const loader = async () => ({ rows: Array.from({ length: 20 }, (_, index) => ({ id: index })) })
  await cacheAside({ key: CACHE_NAMESPACES.profile('bench'), ttlSeconds: 30, loader })
  const overhead = await measure(
    () => cacheAside({ key: CACHE_NAMESPACES.profile('bench'), ttlSeconds: 30, loader }),
    7,
  )
  console.log(`\ncacheAside hit overhead   : ${overhead.medianMs} ms for a 20-row payload`)
  setRedisClientForTests(null)

  console.log('\nNote: hit figures are simulated against real Upstash REST latency.')
  console.log('Set UPSTASH_REDIS_REST_URL/TOKEN for a true end-to-end measurement.\n')
}, 600_000)
