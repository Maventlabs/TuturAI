import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/auth-guard'
import { DriveConfigurationError, ensureDriveFolderStructure, uploadDriveFile } from '@/lib/drive'
import { appendAssignmentAttachment, getTeacherAssignmentDriveContext } from '@/lib/assignments'

export async function POST(request: NextRequest) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response
  const form = await request.formData()
  const file = form.get('file')
  const assignmentId = form.get('assignmentId')
  if (!(file instanceof File) || typeof assignmentId !== 'string') {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'A file and assignmentId are required.' } }, { status: 400 })
  }
  try {
    const context = await getTeacherAssignmentDriveContext(assignmentId, auth.user.uid)
    const folders = await ensureDriveFolderStructure({ teacherId: auth.user.uid, classroomId: context.classroomId, assignmentId })
    const uploaded = await uploadDriveFile({ teacherId: auth.user.uid, file: new Uint8Array(await file.arrayBuffer()), name: file.name, mimeType: file.type, folderId: folders.assignment })
    const assignment = await appendAssignmentAttachment(assignmentId, auth.user.uid, uploaded)
    return NextResponse.json({ data: { file: uploaded, assignment } }, { status: 201 })
  } catch (cause) {
    if (cause instanceof DriveConfigurationError || (cause instanceof Error && cause.message.startsWith('Missing required environment variable'))) {
      return NextResponse.json({ error: { code: 'DRIVE_NOT_CONFIGURED', message: 'Google Drive OAuth is not configured.' } }, { status: 501 })
    }
    if (cause instanceof Error && cause.message === 'ASSIGNMENT_NOT_FOUND') {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Assignment was not found.' } }, { status: 404 })
    }
    if (cause instanceof Error && ['DRIVE_NOT_CONNECTED', 'DRIVE_TOKEN_REFRESH_FAILED'].includes(cause.message)) {
      return NextResponse.json({ error: { code: cause.message, message: 'Connect Google Drive before uploading.' } }, { status: 409 })
    }
    if (cause instanceof Error && ['INVALID_FILE_NAME', 'UNSUPPORTED_FILE_TYPE', 'INVALID_FILE_EXTENSION', 'FILE_TOO_LARGE'].includes(cause.message)) {
      return NextResponse.json({ error: { code: cause.message, message: 'The selected file is invalid.' } }, { status: 400 })
    }
    throw cause
  }
}
