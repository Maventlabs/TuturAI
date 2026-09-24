import { NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { getStudentSubmission } from '@/lib/submissions'

type RouteContext = { params: Promise<{ assignmentId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response
  try {
    const { assignmentId } = await context.params
    const submission = await getStudentSubmission(assignmentId, auth.user.uid)
    if (!submission) return NextResponse.json(apiError('NOT_FOUND', 'Submission was not found'), { status: 404 })
    return NextResponse.json({ data: submission })
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'CLASSROOM_NOT_FOUND') {
      return NextResponse.json(apiError('FORBIDDEN', 'Student is not an active classroom member'), { status: 403 })
    }
    if (cause instanceof Error && cause.message === 'ASSIGNMENT_NOT_FOUND') {
      return NextResponse.json(apiError('NOT_FOUND', 'Published assignment was not found'), { status: 404 })
    }
    throw cause
  }
}
