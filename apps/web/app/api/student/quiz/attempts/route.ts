import { NextResponse } from 'next/server'
import { validateQuizStartInput } from '@tuturai/domain'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { readJsonBody } from '@/lib/api/request'
import { getActiveQuizAttempt, listQuizAttempts, startQuizAttempt } from '@/lib/quiz'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  const [active, history] = await Promise.all([
    getActiveQuizAttempt(auth.user.uid),
    listQuizAttempts(auth.user.uid),
  ])

  return NextResponse.json(
    { data: { active, history } },
    { headers: { 'cache-control': 'no-store' } },
  )
}

export async function POST(request: Request) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  const validation = validateQuizStartInput(await readJsonBody(request))
  if (!validation.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Invalid quiz start input', validation.issues), { status: 400 })
  }

  try {
    const attempt = await startQuizAttempt({ studentId: auth.user.uid, level: validation.data.level })
    return NextResponse.json({ data: attempt }, { status: 201, headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    if (error instanceof Error && error.message === 'QUIZ_BANK_INCOMPLETE') {
      return NextResponse.json(
        apiError('EXTERNAL_SERVICE_ERROR', 'Bank soal untuk level ini belum lengkap', { code: 'QUIZ_BANK_INCOMPLETE' }),
        { status: 503 },
      )
    }
    throw error
  }
}
