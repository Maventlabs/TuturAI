import { NextRequest, NextResponse } from 'next/server'
import { validateMaterialInput, type MaterialStatus } from '@tuturai/domain'
import { apiError } from '@tuturai/validation'
import { requireAuth, requireRole } from '@/lib/api/auth-guard'
import { createTeacherMaterial, listClassroomMaterials } from '@/lib/materials'
import { readJsonBody } from '@/lib/api/request'

type RouteContext = { params: Promise<{ classroomId: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  try {
    const { classroomId } = await context.params
    const materials = await listClassroomMaterials(classroomId, {
      role: auth.profile.role === 'teacher' ? 'teacher' : 'student',
      uid: auth.user.uid,
    })
    return NextResponse.json({ data: materials })
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'CLASSROOM_NOT_FOUND') {
      return NextResponse.json(apiError('NOT_FOUND', 'Classroom was not found'), { status: 404 })
    }
    throw cause
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response

  const body = await readJsonBody(request)
  const validation = validateMaterialInput(body)
  if (!validation.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Invalid material input', validation.issues), { status: 400 })
  }

  const rawStatus = body && typeof body === 'object' ? (body as Record<string, unknown>).status : undefined
  const status: MaterialStatus = rawStatus === 'published' ? 'published' : 'draft'

  try {
    const { classroomId } = await context.params
    const material = await createTeacherMaterial(classroomId, auth.user.uid, validation.data, status)
    return NextResponse.json({ data: material }, { status: 201 })
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'CLASSROOM_NOT_FOUND') {
      return NextResponse.json(apiError('NOT_FOUND', 'Classroom was not found'), { status: 404 })
    }
    throw cause
  }
}
