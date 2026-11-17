import { NextResponse } from 'next/server'
import { validateReadingStartInput } from '@tuturai/domain'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { readJsonBody } from '@/lib/api/request'
import { readingErrorResponse } from '@/lib/api/reading-errors'
import { getReadingOverview, startReadingSession } from '@/lib/reading'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  const overview = await getReadingOverview(auth.user.uid)
  return NextResponse.json({ data: overview }, { headers: { 'cache-control': 'no-store' } })
}

export async function POST(request: Request) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  const validation = validateReadingStartInput(await readJsonBody(request))
  if (!validation.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Invalid reading start input', validation.issues), { status: 400 })
  }

  try {
    const session = await startReadingSession({ studentId: auth.user.uid, level: validation.data.level })
    return NextResponse.json({ data: session }, { status: 201, headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const response = readingErrorResponse(error)
    if (response) return response
    throw error
  }
}
