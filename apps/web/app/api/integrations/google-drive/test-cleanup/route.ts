import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { getRequestId, logApiFailure } from '@/lib/api/observability'
import { getAdminDb } from '@/lib/firebase/admin'
import { deleteDriveFile } from '@/lib/drive'

type CleanupInput = { assignmentId: string; fileId: string; testPrefix: string; submissionId?: string; uploadIdempotencyKey?: string }

function parseCleanupInput(value: unknown): CleanupInput | null {
  if (!value || typeof value !== 'object') return null
  const body = value as Record<string, unknown>
  if (typeof body.assignmentId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(body.assignmentId)) return null
  if (typeof body.fileId !== 'string' || !/^[A-Za-z0-9_-]{10,256}$/.test(body.fileId)) return null
  if (typeof body.testPrefix !== 'string' || !/^e2e-[a-z0-9-]{3,40}$/.test(body.testPrefix)) return null
  if (body.submissionId !== undefined && (typeof body.submissionId !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(body.submissionId))) return null
  if (body.uploadIdempotencyKey !== undefined && (typeof body.uploadIdempotencyKey !== 'string' || !/^[A-Fa-f0-9]{64}$/.test(body.uploadIdempotencyKey))) return null
  return {
    assignmentId: body.assignmentId,
    fileId: body.fileId,
    testPrefix: body.testPrefix,
    ...(typeof body.submissionId === 'string' ? { submissionId: body.submissionId } : {}),
    ...(typeof body.uploadIdempotencyKey === 'string' ? { uploadIdempotencyKey: body.uploadIdempotencyKey } : {}),
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response
  const startedAt = performance.now()
  const requestId = getRequestId(request)

  let input: CleanupInput | null
  try {
    input = parseCleanupInput(await request.json())
  } catch {
    input = null
  }
  if (!input) return NextResponse.json(apiError('VALIDATION_ERROR', 'A valid E2E cleanup request is required', { requestId }), { status: 400 })

  const db = getAdminDb()
  const assignmentRef = db.collection('assignments').doc(input.assignmentId)
  const initialAssignment = await assignmentRef.get()
  const assignmentData = initialAssignment.data()
  const classroomId = assignmentData?.classId
  const classroomRef = typeof classroomId === 'string' ? db.collection('classrooms').doc(classroomId) : null
  const classroom = classroomRef ? await classroomRef.get() : null
  if (
    !initialAssignment.exists
    || assignmentData?.e2eTestPrefix !== input.testPrefix
    || !String(assignmentData?.title ?? '').startsWith(`${input.testPrefix} `)
    || !classroom?.exists
    || classroom.data()?.teacherId !== auth.user.uid
    || classroom.data()?.status !== 'active'
  ) {
    return NextResponse.json(apiError('NOT_FOUND', 'The E2E-owned assignment was not found', { requestId }), { status: 404 })
  }

  const submissionRef = input.submissionId ? db.collection('submissions').doc(input.submissionId) : null
  const initialSubmission = submissionRef ? await submissionRef.get() : null
  const memberRef = initialSubmission?.data()?.studentId && typeof classroomId === 'string'
    ? db.collection('classMemberships').doc(`${classroomId}_${initialSubmission.data()?.studentId}`)
    : null
  const membership = memberRef ? await memberRef.get() : null
  const files = input.submissionId
    ? (Array.isArray(initialSubmission?.data()?.files) ? initialSubmission?.data()?.files as Array<{ id?: string }> : [])
    : (Array.isArray(assignmentData?.attachments) ? assignmentData.attachments as Array<{ id?: string }> : [])
  const referenced = files.some((file) => file.id === input.fileId)
  if (
    input.submissionId
      ? !initialSubmission?.exists || initialSubmission.data()?.assignmentId !== input.assignmentId || !membership?.exists || membership.data()?.status !== 'active'
      : false
  ) {
    return NextResponse.json(apiError('NOT_FOUND', 'The E2E-owned Drive file was not found', { requestId }), { status: 404 })
  }
  const operation = input.uploadIdempotencyKey
    ? await db.collection('googleDriveUploadOperations').doc(createHash('sha256').update(`${auth.user.uid}:${input.uploadIdempotencyKey}`).digest('hex')).get()
    : null
  const operationOwnsFile = Boolean(operation?.exists && operation.data()?.teacherId === auth.user.uid && operation.data()?.driveFileId === input.fileId)
  if (!referenced && !operationOwnsFile) {
    return NextResponse.json({ data: { deleted: false, alreadyCleaned: true, fileId: input.fileId } }, { headers: { 'cache-control': 'no-store', 'x-request-id': requestId } })
  }

  try {
    await deleteDriveFile(auth.user.uid, input.fileId, { allowMissingOperation: true })
    await db.runTransaction(async (transaction) => {
      const assignment = await transaction.get(assignmentRef)
      const currentAssignment = assignment.data()
      const currentClassId = currentAssignment?.classId
      const currentClassroomRef = typeof currentClassId === 'string' ? db.collection('classrooms').doc(currentClassId) : null
      const currentClassroom = currentClassroomRef ? await transaction.get(currentClassroomRef) : null
      if (
        !assignment.exists
        || currentAssignment?.e2eTestPrefix !== input.testPrefix
        || !String(currentAssignment?.title ?? '').startsWith(`${input.testPrefix} `)
        || !currentClassroom?.exists
        || currentClassroom.data()?.teacherId !== auth.user.uid
      ) throw new Error('E2E_CLEANUP_SCOPE_CHANGED')

      if (input.submissionId) {
        const submission = await transaction.get(submissionRef!)
        const submissionData = submission.data()
        if (!submission.exists || submissionData?.assignmentId !== input.assignmentId) throw new Error('E2E_CLEANUP_SCOPE_CHANGED')
        const currentFiles = Array.isArray(submissionData.files) ? submissionData.files as Array<{ id?: string }> : []
        if (currentFiles.some((file) => file.id === input.fileId)) {
          transaction.update(submissionRef!, { files: currentFiles.filter((file) => file.id !== input.fileId), updatedAt: Timestamp.now() })
        }
      } else {
        const currentFiles = Array.isArray(currentAssignment.attachments) ? currentAssignment.attachments as Array<{ id?: string }> : []
        if (currentFiles.some((file) => file.id === input.fileId)) {
          transaction.update(assignmentRef, { attachments: currentFiles.filter((file) => file.id !== input.fileId), updatedAt: Timestamp.now() })
        }
      }
    })
    return NextResponse.json({ data: { deleted: true, fileId: input.fileId } }, { headers: { 'cache-control': 'no-store', 'x-request-id': requestId } })
  } catch (cause) {
    const code = cause instanceof Error && ['DRIVE_NOT_CONNECTED', 'DRIVE_REAUTH_REQUIRED', 'DRIVE_REQUEST_TIMEOUT', 'DRIVE_PROVIDER_UNAVAILABLE', 'DRIVE_DELETE_FAILED'].includes(cause.message)
      ? cause.message
      : 'E2E_DRIVE_CLEANUP_FAILED'
    logApiFailure({ requestId, route: '/api/integrations/google-drive/test-cleanup', status: 503, errorCode: code, provider: 'google-drive', durationMs: performance.now() - startedAt })
    return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'E2E Drive cleanup is not confirmed; retry the same file ID', { code, retryable: true, requestId }), { status: 503 })
  }
}
