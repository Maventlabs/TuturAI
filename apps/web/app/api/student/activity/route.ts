import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/auth-guard'
import { getAdminDb } from '@/lib/firebase/admin'
import { cacheAside } from '@/lib/cache'
import { CACHE_NAMESPACES, CACHE_TTL } from '@/lib/cache/keys'
import { buildActivitySeries, toUtcDay } from '@/lib/student-activity'

/** 53 weeks, so the heatmap can show a full year without a second request. */
const WINDOW_DAYS = 371
const SOURCE_LIMIT = 500

export async function GET() {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  const { value } = await cacheAside({
    key: CACHE_NAMESPACES.studentActivity(auth.user.uid),
    ttlSeconds: CACHE_TTL.analytics,
    loader: async () => {
      const db = getAdminDb()
      const [quizAttempts, practiceAttempts, assessments] = await Promise.all([
        db.collection('questionAttempts').where('studentId', '==', auth.user.uid).limit(SOURCE_LIMIT).get(),
        db.collection('practiceAttempts').where('studentId', '==', auth.user.uid).limit(SOURCE_LIMIT).get(),
        db.collection('assessments').where('studentId', '==', auth.user.uid).limit(SOURCE_LIMIT).get(),
      ])

      const dayKeys = [...quizAttempts.docs, ...practiceAttempts.docs, ...assessments.docs].map((doc) =>
        toUtcDay(doc.data().createdAt),
      )

      return {
        windowDays: WINDOW_DAYS,
        days: buildActivitySeries(dayKeys, new Date(), WINDOW_DAYS),
      }
    },
  })

  return NextResponse.json({ data: value })
}
