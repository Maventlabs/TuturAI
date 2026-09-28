import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { completeDriveOAuth, DriveConfigurationError } from '@/lib/drive'
import { getRequestId, logApiFailure } from '@/lib/api/observability'

export async function GET(request: NextRequest) {
  const startedAt = performance.now()
  const requestId = getRequestId(request)
  const state = request.nextUrl.searchParams.get('state')
  const code = request.nextUrl.searchParams.get('code')
  if (request.nextUrl.searchParams.has('error')) {
    return NextResponse.json(apiError('FORBIDDEN', 'Google Drive authorization was cancelled', { code: 'DRIVE_OAUTH_CANCELLED', requestId }), { status: 400 })
  }
  if (!state || !code) return NextResponse.json(apiError('VALIDATION_ERROR', 'OAuth state and code are required', { code: 'INVALID_OAUTH_CALLBACK', requestId }), { status: 400 })
  try {
    await completeDriveOAuth(state, code)
    return NextResponse.redirect(new URL('/guru/pengaturan?drive=connected', request.url), { headers: { 'cache-control': 'no-store', 'x-request-id': requestId } })
  } catch (cause) {
    if (cause instanceof DriveConfigurationError || (cause instanceof Error && cause.message.startsWith('Missing required environment variable'))) {
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Google Drive OAuth is not configured', { code: 'DRIVE_NOT_CONFIGURED', requestId }), { status: 501 })
    }
    if (cause instanceof Error && ['INVALID_OAUTH_STATE', 'DRIVE_OAUTH_EXCHANGE_FAILED', 'DRIVE_REFRESH_TOKEN_MISSING'].includes(cause.message)) {
      const status = cause.message === 'DRIVE_REFRESH_TOKEN_MISSING' ? 502 : 400
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Google Drive authorization could not be completed', { code: cause.message, retryable: false, requestId }), { status })
    }
    if (cause instanceof Error && ['DRIVE_REQUEST_TIMEOUT', 'DRIVE_PROVIDER_UNAVAILABLE'].includes(cause.message)) {
      logApiFailure({ requestId, route: '/api/integrations/google-drive/callback', status: 503, errorCode: cause.message, provider: 'google-drive', durationMs: performance.now() - startedAt })
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Google could not confirm Drive authorization; reconnect to retry', { code: cause.message, retryable: true, requestId }), { status: 503 })
    }
    const errorCode = cause instanceof Error && cause.message === 'DRIVE_INVALID_RESPONSE' ? cause.message : 'DRIVE_OAUTH_CALLBACK_FAILED'
    logApiFailure({ requestId, route: '/api/integrations/google-drive/callback', status: 500, errorCode, provider: 'google-drive', durationMs: performance.now() - startedAt })
    return NextResponse.json(apiError('INTERNAL_ERROR', 'Google Drive authorization could not be completed', { code: errorCode, retryable: false, requestId }), { status: 500 })
  }
}
