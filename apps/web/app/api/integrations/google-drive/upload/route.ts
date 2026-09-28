import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { deleteDriveFile, DriveConfigurationError, ensureDriveFolderStructure, uploadDriveFile, validateDriveFile } from '@/lib/drive'
import { appendAssignmentAttachment, getTeacherAssignmentDriveContext } from '@/lib/assignments'
import { consumeApiRateLimit, rateLimitResponse } from '@/lib/api/rate-limit'
import { getRequestId, logApiFailure } from '@/lib/api/observability'

const FILE_VALIDATION_ERRORS = new Set(['INVALID_FILE_NAME', 'UNSUPPORTED_FILE_TYPE', 'INVALID_FILE_EXTENSION', 'FILE_TOO_LARGE'])
const PROVIDER_FAILURES = new Set([
  'DRIVE_REQUEST_TIMEOUT',
  'DRIVE_PROVIDER_UNAVAILABLE',
  'DRIVE_UPLOAD_FAILED',
  'DRIVE_FILE_ID_GENERATION_FAILED',
  'DRIVE_API_FAILED',
  'DRIVE_INVALID_RESPONSE',
  'DRIVE_IDEMPOTENCY_CONFLICT',
  'DRIVE_ACCESS_TOKEN_MISSING',
])

export async function POST(request: NextRequest) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response
  const startedAt = performance.now()
  const requestId = getRequestId(request)
  let file: File
  let assignmentId: string
  try {
    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return NextResponse.json(apiError('VALIDATION_ERROR', 'A valid multipart file request is required', { requestId }), { status: 400 })
    }
    const entry = form.get('file')
    const assignmentEntry = form.get('assignmentId')
    if (!(entry instanceof File) || typeof assignmentEntry !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(assignmentEntry)) {
      return NextResponse.json(apiError('VALIDATION_ERROR', 'A file and valid assignmentId are required', { requestId }), { status: 400 })
    }
    file = entry
    assignmentId = assignmentEntry
    const metadata = validateDriveFile({ name: file.name, mimeType: file.type, size: file.size })
    const suppliedKey = request.headers.get('Idempotency-Key')?.trim()
    if (suppliedKey && suppliedKey.length > 256) {
      return NextResponse.json(apiError('VALIDATION_ERROR', 'Idempotency-Key is too long', { requestId }), { status: 400 })
    }
    await consumeApiRateLimit({ scope: 'drive-upload', subject: auth.user.uid, limit: 20, windowMs: 15 * 60 * 1_000 })
    const context = await getTeacherAssignmentDriveContext(assignmentId, auth.user.uid)
    const folders = await ensureDriveFolderStructure({ teacherId: auth.user.uid, classroomId: context.classroomId, assignmentId })
    const bytes = new Uint8Array(await file.arrayBuffer())
    const idempotencyKey = suppliedKey ?? createHash('sha256').update(auth.user.uid).update('\0').update(assignmentId).update('\0').update(metadata.name).update('\0').update(bytes).digest('hex')
    const uploaded = await uploadDriveFile({ teacherId: auth.user.uid, file: bytes, name: metadata.name, mimeType: metadata.mimeType, folderId: folders.assignment, idempotencyKey })
    let assignment
    try {
      assignment = await appendAssignmentAttachment(assignmentId, auth.user.uid, uploaded)
    } catch {
      try {
        await deleteDriveFile(auth.user.uid, uploaded.id)
      } catch {
        logApiFailure({ requestId, route: '/api/integrations/google-drive/upload', status: 503, errorCode: 'DRIVE_COMPENSATION_FAILED', provider: 'google-drive', durationMs: performance.now() - startedAt })
        return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Drive file cleanup could not be confirmed; retry with the same Idempotency-Key', { code: 'DRIVE_COMPENSATION_FAILED', retryable: true, requestId }), { status: 503 })
      }
      logApiFailure({ requestId, route: '/api/integrations/google-drive/upload', status: 503, errorCode: 'DRIVE_METADATA_PERSISTENCE_FAILED', provider: 'firestore', durationMs: performance.now() - startedAt })
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Drive file metadata was not saved; retry with the same Idempotency-Key', { code: 'DRIVE_METADATA_PERSISTENCE_FAILED', retryable: true, requestId }), { status: 503 })
    }
    return NextResponse.json({ data: { file: uploaded, assignment } }, { status: 201, headers: { 'cache-control': 'no-store', 'x-request-id': requestId } })
  } catch (cause) {
    const limited = rateLimitResponse(cause)
    if (limited) return limited
    if (cause instanceof DriveConfigurationError || (cause instanceof Error && cause.message.startsWith('Missing required environment variable'))) {
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Google Drive OAuth is not configured', { code: 'DRIVE_NOT_CONFIGURED', retryable: false, requestId }), { status: 501 })
    }
    if (cause instanceof Error && cause.message === 'ASSIGNMENT_NOT_FOUND') {
      return NextResponse.json(apiError('NOT_FOUND', 'Assignment was not found', { requestId }), { status: 404 })
    }
    if (cause instanceof Error && ['DRIVE_NOT_CONNECTED', 'DRIVE_REAUTH_REQUIRED', 'DRIVE_REFRESH_TOKEN_MISSING'].includes(cause.message)) {
      return NextResponse.json(apiError('CONFLICT', 'Reconnect Google Drive before uploading', { code: cause.message, retryable: false, requestId }), { status: 409 })
    }
    if (cause instanceof Error && cause.message === 'DRIVE_IDEMPOTENCY_KEY_REUSED') {
      return NextResponse.json(apiError('CONFLICT', 'Idempotency key was reused with different file data', { code: cause.message, requestId }), { status: 409 })
    }
    if (cause instanceof Error && FILE_VALIDATION_ERRORS.has(cause.message)) {
      return NextResponse.json(apiError('VALIDATION_ERROR', 'The selected file is invalid', { code: cause.message, requestId }), { status: 400 })
    }
    if (cause instanceof Error && PROVIDER_FAILURES.has(cause.message)) {
      logApiFailure({ requestId, route: '/api/integrations/google-drive/upload', status: 502, errorCode: cause.message, provider: 'google-drive', durationMs: performance.now() - startedAt })
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Google Drive did not confirm the upload; retry with the same Idempotency-Key', { code: cause.message, retryable: true, requestId }), { status: 502 })
    }
    logApiFailure({ requestId, route: '/api/integrations/google-drive/upload', status: 500, errorCode: 'DRIVE_UPLOAD_INTERNAL_ERROR', provider: 'google-drive', durationMs: performance.now() - startedAt })
    return NextResponse.json(apiError('INTERNAL_ERROR', 'Drive upload could not be completed', { code: 'DRIVE_UPLOAD_INTERNAL_ERROR', retryable: false, requestId }), { status: 500 })
  }
}
