import { NextResponse } from 'next/server'
import type { UserRole } from '@tuturai/domain'
import { apiError } from '@tuturai/validation'
import { getSessionProfile } from '@/lib/auth'

export async function requireAuth() {
  const { user, profile, profileUnavailable } = await getSessionProfile()

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json(apiError('UNAUTHENTICATED', 'Authentication is required'), { status: 401 }),
    }
  }

  if (profileUnavailable) {
    return {
      ok: false as const,
      response: NextResponse.json(
        apiError('EXTERNAL_SERVICE_ERROR', 'Profile data is temporarily unavailable', {
          code: 'PROFILE_UNAVAILABLE',
          retryable: true,
        }),
        { status: 503 },
      ),
    }
  }

  if (!profile) {
    return {
      ok: false as const,
      response: NextResponse.json(apiError('UNAUTHENTICATED', 'Authentication is required'), { status: 401 }),
    }
  }

  return { ok: true as const, user, profile }
}

export async function requireRole(requiredRole: UserRole) {
  const auth = await requireAuth()
  if (!auth.ok) return auth

  if (auth.profile.role !== requiredRole) {
    return {
      ok: false as const,
      response: NextResponse.json(apiError('FORBIDDEN', 'This action is not available for your role'), { status: 403 }),
    }
  }

  return auth
}
