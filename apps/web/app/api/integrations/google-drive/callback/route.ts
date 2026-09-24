import { NextRequest, NextResponse } from 'next/server'
import { completeDriveOAuth, DriveConfigurationError } from '@/lib/drive'

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get('state')
  const code = request.nextUrl.searchParams.get('code')
  if (!state || !code) return NextResponse.json({ error: { code: 'INVALID_OAUTH_CALLBACK', message: 'OAuth state and code are required.' } }, { status: 400 })
  try {
    await completeDriveOAuth(state, code)
    return NextResponse.redirect(new URL('/guru/pengaturan?drive=connected', request.url))
  } catch (cause) {
    if (cause instanceof DriveConfigurationError || (cause instanceof Error && cause.message.startsWith('Missing required environment variable'))) {
      return NextResponse.json({ error: { code: 'DRIVE_NOT_CONFIGURED', message: 'Google Drive OAuth is not configured.' } }, { status: 501 })
    }
    if (cause instanceof Error && ['INVALID_OAUTH_STATE', 'DRIVE_OAUTH_EXCHANGE_FAILED', 'DRIVE_REFRESH_TOKEN_MISSING'].includes(cause.message)) {
      return NextResponse.json({ error: { code: cause.message, message: 'Google Drive authorization could not be completed.' } }, { status: 400 })
    }
    throw cause
  }
}
