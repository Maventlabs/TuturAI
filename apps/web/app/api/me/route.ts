import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth-guard'

const permissions = {
  student: ['classrooms:join', 'assignments:submit', 'speaking:practice', 'progress:read'],
  teacher: ['classrooms:manage', 'assignments:manage', 'submissions:review', 'analytics:read'],
} as const

export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  return NextResponse.json({
    data: {
      user: auth.user,
      profile: auth.profile,
      permissions: permissions[auth.profile.role],
    },
  })
}
