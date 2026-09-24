import { NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { getSessionProfile } from '@/lib/firebase/session'

export async function GET() {
  const { user } = await getSessionProfile()
  if (!user) return NextResponse.json(apiError('UNAUTHENTICATED', 'Authentication required'), { status: 401 })
  return NextResponse.json(apiError('INTERNAL_ERROR', 'Device status integration is not configured'), { status: 501 })
}
