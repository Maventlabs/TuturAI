import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { DomainRuleError } from '@tuturai/domain'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { appendSubmissionFile, submitAssignment } from '@/lib/submissions'
import { deleteDriveFile, DriveConfigurationError, ensureDriveFolderStructure, uploadDriveFile, validateDriveFile } from '@/lib/drive'
import { getStudentAssignmentDriveContext } from '@/lib/assignments'
import { getRequestId, logApiFailure } from '@/lib/api/observability'
import { consumeApiRateLimit, rateLimitResponse } from '@/lib/api/rate-limit'

type RouteContext = { params: Promise<{ assignmentId: string }> }

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response
  const startedAt = performance.now()
  const requestId = getRequestId(request)

  try {
    const { assignmentId } = await context.params
    const idempotencyKey = request.headers.get('Idempotency-Key')?.trim() || undefined
    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      let form: FormData
      try {
        form = await request.formData()
      } catch {
        return NextResponse.json(apiError('VALIDATION_ERROR', 'A valid multipart submission is required', { requestId }), { status: 400 })
      }
      const file = form.get('file')
      if (form.has('file') && !(file instanceof File)) {
        return NextResponse.json(apiError('VALIDATION_ERROR', 'Submission file must be a valid file upload', { requestId }), { status: 400 })
      }
      if (file instanceof File) {
        if (!idempotencyKey || !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) {
          return NextResponse.json(apiError('VALIDATION_ERROR', 'A stable Idempotency-Key is required for file submissions', { requestId }), { status: 400 })
        }
        const metadata = validateDriveFile({ name: file.name, mimeType: file.type, size: file.size })
        try {
          await consumeApiRateLimit({ scope: 'drive-upload', subject: auth.user.uid, limit: 20, windowMs: 15 * 60 * 1_000 })
        } catch (cause) {
          const limited = rateLimitResponse(cause)
          if (limited) return limited
          throw cause
        }
        const context = await getStudentAssignmentDriveContext(assignmentId, auth.user.uid)
        const folders = await ensureDriveFolderStructure({ teacherId: context.teacherId, classroomId: context.classroomId, assignmentId, studentId: auth.user.uid })
        const bytes = new Uint8Array(await file.arrayBuffer())
        const uploadIdempotencyKey = createHash('sha256').update(auth.user.uid).update('\0').update(assignmentId).update('\0').update(idempotencyKey).digest('hex')
        const uploaded = await uploadDriveFile({ teacherId: context.teacherId, file: bytes, name: metadata.name, mimeType: metadata.mimeType, folderId: folders.student, idempotencyKey: uploadIdempotencyKey })
        let submission
        try {
          submission = await submitAssignment(assignmentId, auth.user.uid, idempotencyKey)
        } catch (cause) {
          try {
            await deleteDriveFile(context.teacherId, uploaded.id)
          } catch {
            throw new Error('DRIVE_COMPENSATION_FAILED')
          }
          throw cause
        }
        try {
          const saved = await appendSubmissionFile(submission.id, auth.user.uid, uploaded)
          return NextResponse.json({ data: saved }, { status: 201, headers: { 'cache-control': 'no-store', 'x-request-id': requestId } })
        } catch {
          try {
            await deleteDriveFile(context.teacherId, uploaded.id)
          } catch {
            throw new Error('DRIVE_COMPENSATION_FAILED')
          }
          return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Drive file metadata was not saved; retry with the same Idempotency-Key', { code: 'DRIVE_METADATA_PERSISTENCE_FAILED', retryable: true, requestId }), { status: 503 })
        }
      }
    }
    const submission = await submitAssignment(assignmentId, auth.user.uid, idempotencyKey)
    return NextResponse.json({ data: submission }, { status: 201, headers: { 'cache-control': 'no-store', 'x-request-id': requestId } })
  } catch (cause) {
    if (cause instanceof Error && ['INVALID_FILE_NAME', 'UNSUPPORTED_FILE_TYPE', 'INVALID_FILE_EXTENSION', 'FILE_TOO_LARGE'].includes(cause.message)) {
      return NextResponse.json(apiError('VALIDATION_ERROR', 'The selected submission file is invalid', { code: cause.message, requestId }), { status: 400 })
    }
    if (cause instanceof Error && cause.message === 'ASSIGNMENT_NOT_FOUND') {
      return NextResponse.json(apiError('NOT_FOUND', 'Published assignment was not found', { requestId }), { status: 404 })
    }
    if (cause instanceof Error && cause.message === 'CLASSROOM_NOT_FOUND') {
      return NextResponse.json(apiError('FORBIDDEN', 'Student is not an active classroom member', { requestId }), { status: 403 })
    }
    if (cause instanceof DomainRuleError) {
      return NextResponse.json(apiError('CONFLICT', cause.message, { requestId }), { status: 409 })
    }
    if (cause instanceof DriveConfigurationError || (cause instanceof Error && cause.message.startsWith('Missing required environment variable'))) {
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Google Drive OAuth is not configured', { code: 'DRIVE_NOT_CONFIGURED', requestId }), { status: 501 })
    }
    if (cause instanceof Error && ['DRIVE_NOT_CONNECTED', 'DRIVE_REAUTH_REQUIRED', 'DRIVE_REFRESH_TOKEN_MISSING'].includes(cause.message)) {
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'The teacher must reconnect Google Drive before this file can be submitted', { code: cause.message, retryable: true, requestId }), { status: 503 })
    }
    if (cause instanceof Error && cause.message === 'DRIVE_IDEMPOTENCY_KEY_REUSED') {
      return NextResponse.json(apiError('CONFLICT', 'Idempotency key was reused with different file data', { code: cause.message, requestId }), { status: 409 })
    }
    if (cause instanceof Error && cause.message === 'DRIVE_COMPENSATION_FAILED') {
      logApiFailure({ requestId, route: '/api/assignments/[assignmentId]/submit', status: 503, errorCode: cause.message, provider: 'google-drive', durationMs: performance.now() - startedAt })
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Drive cleanup was not confirmed; retry with the same Idempotency-Key', { code: cause.message, retryable: true, requestId }), { status: 503 })
    }
    if (cause instanceof Error && ['DRIVE_REQUEST_TIMEOUT', 'DRIVE_PROVIDER_UNAVAILABLE', 'DRIVE_UPLOAD_FAILED', 'DRIVE_FILE_ID_GENERATION_FAILED', 'DRIVE_API_FAILED', 'DRIVE_INVALID_RESPONSE', 'DRIVE_IDEMPOTENCY_CONFLICT', 'DRIVE_ACCESS_TOKEN_MISSING', 'DRIVE_TOKEN_REFRESH_FAILED'].includes(cause.message)) {
      logApiFailure({ requestId, route: '/api/assignments/[assignmentId]/submit', status: 502, errorCode: cause.message, provider: 'google-drive', durationMs: performance.now() - startedAt })
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Drive upload is not confirmed; retry with the same Idempotency-Key', { code: cause.message, retryable: true, requestId }), { status: 502 })
    }
    logApiFailure({ requestId, route: '/api/assignments/[assignmentId]/submit', status: 500, errorCode: 'ASSIGNMENT_SUBMISSION_FAILED', provider: 'firestore', durationMs: performance.now() - startedAt })
    return NextResponse.json(apiError('INTERNAL_ERROR', 'Assignment submission could not be completed', { code: 'ASSIGNMENT_SUBMISSION_FAILED', retryable: false, requestId }), { status: 500 })
  }
}
