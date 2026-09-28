import { NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { disconnectDrive, DriveConfigurationError } from '@/lib/drive'

export async function POST() {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response
  try {
    await disconnectDrive(auth.user.uid)
    return NextResponse.json({ data: { connected: false } })
  } catch (cause) {
    if (cause instanceof DriveConfigurationError || (cause instanceof Error && cause.message.startsWith('Missing required environment variable'))) {
      return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Google Drive disconnect is not configured', { code: 'DRIVE_NOT_CONFIGURED' }), { status: 501 })
    }
    const code = cause instanceof Error && ['DRIVE_REQUEST_TIMEOUT', 'DRIVE_PROVIDER_UNAVAILABLE', 'DRIVE_REFRESH_TOKEN_MISSING', 'DRIVE_TOKEN_REVOKE_FAILED'].includes(cause.message)
      ? cause.message
      : 'DRIVE_DISCONNECT_FAILED'
    return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Google Drive could not confirm token revocation; connection remains available for retry', { code, retryable: true }), { status: 503 })
  }
}
