import { NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { appendSubmissionFile, submitAssignment } from '@/lib/submissions'
import { deleteDriveFile, DriveConfigurationError, ensureDriveFolderStructure, uploadDriveFile } from '@/lib/drive'
import { getStudentAssignmentDriveContext } from '@/lib/assignments'

type RouteContext = { params: Promise<{ assignmentId: string }> }

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  try {
    const { assignmentId } = await context.params
    const idempotencyKey = request.headers.get('Idempotency-Key')?.trim() || undefined
    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('file')
      if (file instanceof File) {
        const context = await getStudentAssignmentDriveContext(assignmentId, auth.user.uid)
        const folders = await ensureDriveFolderStructure({ teacherId: context.teacherId, classroomId: context.classroomId, assignmentId, studentId: auth.user.uid })
        const uploaded = await uploadDriveFile({ teacherId: context.teacherId, file: new Uint8Array(await file.arrayBuffer()), name: file.name, mimeType: file.type, folderId: folders.student })
        try {
          const submission = await submitAssignment(assignmentId, auth.user.uid, idempotencyKey)
          return NextResponse.json({ data: await appendSubmissionFile(submission.id, auth.user.uid, uploaded) }, { status: 201 })
        } catch (cause) {
          await deleteDriveFile(context.teacherId, uploaded.id)
          throw cause
        }
      }
    }
    const submission = await submitAssignment(assignmentId, auth.user.uid, idempotencyKey)
    return NextResponse.json({ data: submission }, { status: 201 })
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'ASSIGNMENT_NOT_FOUND') {
      return NextResponse.json(apiError('NOT_FOUND', 'Published assignment was not found'), { status: 404 })
    }
    if (cause instanceof Error && cause.message === 'CLASSROOM_NOT_FOUND') {
      return NextResponse.json(apiError('FORBIDDEN', 'Student is not an active classroom member'), { status: 403 })
    }
    if (cause instanceof Error && cause.message === 'MAX_ATTEMPTS_REACHED') {
      return NextResponse.json(apiError('CONFLICT', 'No attempts remaining'), { status: 409 })
    }
    if (cause instanceof DriveConfigurationError || (cause instanceof Error && cause.message.startsWith('Missing required environment variable'))) {
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Google Drive OAuth is not configured'), { status: 501 })
    }
    if (cause instanceof Error && ['DRIVE_NOT_CONNECTED', 'DRIVE_TOKEN_REFRESH_FAILED', 'DRIVE_UPLOAD_FAILED'].includes(cause.message)) {
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'File belum tersimpan; submission belum dikonfirmasi'), { status: 502 })
    }
    throw cause
  }
}
