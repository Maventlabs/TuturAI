import { NextRequest, NextResponse } from 'next/server'
import { validateClassroomInput } from '@tuturai/domain'
import { apiError } from '@tuturai/validation'
import { requireAuth, requireRole } from '@/lib/api/auth-guard'
import { createTeacherClassroom, listStudentClassrooms, listTeacherClassrooms } from '@/lib/classrooms'
import { readJsonBody } from '@/lib/api/request'

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const classrooms = auth.profile.role === 'teacher'
    ? await listTeacherClassrooms(auth.user.uid)
    : await listStudentClassrooms(auth.user.uid)
  return NextResponse.json({ data: classrooms })
}

export async function POST(request: NextRequest) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response

  const validation = validateClassroomInput(await readJsonBody(request))
  if (!validation.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Invalid classroom input', validation.issues), { status: 400 })
  }

  const { classroom, joinKey } = await createTeacherClassroom(auth.user.uid, validation.data)

  return NextResponse.json({
    data: { ...classroom, joinKey },
  }, { status: 201 })
}
