import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { DriveConfigurationError, getDriveConnectionStatus } from '@/lib/drive'
import { getRequestId, logApiFailure } from '@/lib/api/observability'

export async function GET(request: NextRequest) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response
  const startedAt = performance.now()
  const requestId = getRequestId(request)
  try {
    return NextResponse.json({ data: await getDriveConnectionStatus(auth.user.uid) }, { headers: { 'cache-control': 'no-store', 'x-request-id': requestId } })
  } catch (cause) {
    if (cause instanceof DriveConfigurationError || (cause instanceof Error && cause.message.startsWith('Missing required environment variable'))) {
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Google Drive OAuth is not configured', { code: 'DRIVE_NOT_CONFIGURED', requestId }), { status: 501 })
    }
    logApiFailure({ requestId, route: '/api/integrations/google-drive/status', status: 500, errorCode: 'DRIVE_STATUS_FAILED', provider: 'firestore', durationMs: performance.now() - startedAt })
    return NextResponse.json(apiError('INTERNAL_ERROR', 'Google Drive connection status could not be loaded', { code: 'DRIVE_STATUS_FAILED', retryable: true, requestId }), { status: 500 })
  }
}
