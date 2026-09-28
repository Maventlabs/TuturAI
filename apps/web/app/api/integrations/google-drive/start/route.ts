import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { createDriveOAuthState, DriveConfigurationError } from '@/lib/drive'
import { consumeApiRateLimit, rateLimitResponse } from '@/lib/api/rate-limit'
import { getRequestId, logApiFailure } from '@/lib/api/observability'

export async function GET(request: NextRequest) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response
  const startedAt = performance.now()
  const requestId = getRequestId(request)
  try {
    await consumeApiRateLimit({ scope: 'drive-oauth', subject: auth.user.uid, limit: 10, windowMs: 60 * 60 * 1_000 })
    return NextResponse.redirect(await createDriveOAuthState(auth.user.uid), { headers: { 'cache-control': 'no-store', 'x-request-id': requestId } })
  } catch (cause) {
    const limited = rateLimitResponse(cause)
    if (limited) return limited
    if (cause instanceof DriveConfigurationError || (cause instanceof Error && cause.message.startsWith('Missing required environment variable'))) {
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Google Drive OAuth is not configured', { code: 'DRIVE_NOT_CONFIGURED', requestId }), { status: 501 })
    }
    logApiFailure({ requestId, route: '/api/integrations/google-drive/start', status: 500, errorCode: 'DRIVE_OAUTH_START_FAILED', provider: 'firestore', durationMs: performance.now() - startedAt })
    return NextResponse.json(apiError('INTERNAL_ERROR', 'Google Drive connection could not be started', { code: 'DRIVE_OAUTH_START_FAILED', retryable: true, requestId }), { status: 500 })
  }
}
