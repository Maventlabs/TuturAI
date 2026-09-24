import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/auth-guard'
import { createDriveOAuthState, DriveConfigurationError } from '@/lib/drive'

export async function GET() {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response
  try {
    return NextResponse.redirect(await createDriveOAuthState(auth.user.uid))
  } catch (cause) {
    if (cause instanceof DriveConfigurationError || (cause instanceof Error && cause.message.startsWith('Missing required environment variable'))) {
      return NextResponse.json({ error: { code: 'DRIVE_NOT_CONFIGURED', message: 'Google Drive OAuth is not configured.' } }, { status: 501 })
    }
    throw cause
  }
}
