import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/auth-guard'
import { listTeacherReviewQueue } from '@/lib/submissions'

export async function GET() {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response
  const data = await listTeacherReviewQueue(auth.user.uid)
  return NextResponse.json({ data })
}
