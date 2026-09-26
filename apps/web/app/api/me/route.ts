import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { apiError, validateProfileUpdateInput } from '@tuturai/validation'
import { requireAuth } from '@/lib/api/auth-guard'
import { getAdminDb } from '@/lib/firebase/admin'
import { readJsonBody } from '@/lib/api/request'

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

export async function PATCH(request: Request) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const validation = validateProfileUpdateInput(await readJsonBody(request))
  if (!validation.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Invalid profile update', validation.issues), { status: 400 })
  }

  try {
    const ref = getAdminDb().collection('users').doc(auth.user.uid)
    await ref.update({
      displayName: validation.data.displayName,
      school: validation.data.school,
      updatedAt: FieldValue.serverTimestamp(),
    })
    const snapshot = await ref.get()
    const data = snapshot.data() ?? {}

    return NextResponse.json({
      data: {
        profile: {
          ...auth.profile,
          full_name: typeof data.displayName === 'string' ? data.displayName : validation.data.displayName,
          school: typeof data.school === 'string' ? data.school : validation.data.school,
        },
      },
    })
  } catch {
    return NextResponse.json(apiError('INTERNAL_ERROR', 'Unable to update profile'), { status: 500 })
  }
}
