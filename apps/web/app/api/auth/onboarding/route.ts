import { NextRequest, NextResponse } from 'next/server'
import { apiError, validateOnboardingInput } from '@tuturai/validation'
import { createOrReadProfile } from '@/lib/firebase/onboarding'
import { verifyIdToken } from '@/lib/firebase/session'
import { readJsonBody } from '@/lib/api/request'

function bearerToken(request: NextRequest) {
  const value = request.headers.get('authorization')
  if (!value?.startsWith('Bearer ')) return null
  return value.slice('Bearer '.length).trim()
}

export async function POST(request: NextRequest) {
  const token = bearerToken(request)
  if (!token) return NextResponse.json(apiError('UNAUTHENTICATED', 'Bearer token is required'), { status: 401 })

  let decoded: Awaited<ReturnType<typeof verifyIdToken>>
  try {
    decoded = await verifyIdToken(token)
  } catch {
    return NextResponse.json(apiError('UNAUTHENTICATED', 'Unable to complete onboarding'), { status: 401 })
  }

  const validation = validateOnboardingInput(await readJsonBody(request))
  if (!validation.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Invalid onboarding input', validation.issues), { status: 400 })
  }

  try {
    const profile = await createOrReadProfile(decoded.uid, decoded.email ?? null, validation.data)
    return NextResponse.json({ data: profile }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'ROLE_ALREADY_SET') {
      return NextResponse.json(apiError('CONFLICT', 'Role is already set for this account'), { status: 409 })
    }
    return NextResponse.json(apiError('INTERNAL_ERROR', 'Unable to save onboarding profile'), { status: 500 })
  }
}
