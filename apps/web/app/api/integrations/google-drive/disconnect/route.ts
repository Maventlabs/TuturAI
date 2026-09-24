import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/auth-guard'
import { disconnectDrive } from '@/lib/drive'

export async function POST() {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response
  await disconnectDrive(auth.user.uid)
  return NextResponse.json({ data: { connected: false } })
}
