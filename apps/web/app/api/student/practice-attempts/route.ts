import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { createPracticeAttempt, validatePracticeAttemptInput } from '@/lib/practice-attempts'

export async function POST(request: NextRequest) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'A valid JSON payload is required'), { status: 400 })
  }
  const idempotencyKey = request.headers.get('Idempotency-Key')?.trim()
  const validation = validatePracticeAttemptInput({
    ...(body && typeof body === 'object' ? body : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  })
  if (!validation.success) return NextResponse.json(apiError('VALIDATION_ERROR', validation.message), { status: 400 })

  try {
    const result = await createPracticeAttempt(auth.user.uid, validation.data)
    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'QUESTION_NOT_FOUND') {
      return NextResponse.json(apiError('NOT_FOUND', 'Practice content not found'), { status: 404 })
    }
    throw error
  }
}
