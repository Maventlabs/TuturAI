import { NextResponse } from 'next/server'
import { validateReadingAnswerInput } from '@tuturai/domain'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { readJsonBody } from '@/lib/api/request'
import { readingErrorResponse } from '@/lib/api/reading-errors'
import { saveReadingAnswer } from '@/lib/reading'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ attemptId: string }> }

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  const validation = validateReadingAnswerInput(await readJsonBody(request))
  if (!validation.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Invalid answer input', validation.issues), { status: 400 })
  }

  const { attemptId } = await context.params

  try {
    const saved = await saveReadingAnswer({
      studentId: auth.user.uid,
      attemptId,
      questionId: validation.data.questionId,
      selectedOption: validation.data.selectedOption,
    })
    return NextResponse.json({ data: saved }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const response = readingErrorResponse(error)
    if (response) return response
    throw error
  }
}
