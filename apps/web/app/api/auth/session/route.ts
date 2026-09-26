import { NextRequest, NextResponse } from 'next/server'
import { apiError, type ApiErrorCode } from '@tuturai/validation'
import { createSessionCookie, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/firebase/session'
import { readJsonBody } from '@/lib/api/request'

function classifySessionFailure(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code
    : null
  const missingEnvironmentVariable = message.match(/Missing required environment variable: ([A-Z0-9_]+)/)?.[1] ?? null
  const projectMismatch = message.includes('FIREBASE_ADMIN_PROJECT_ID must match NEXT_PUBLIC_FIREBASE_PROJECT_ID')
  const adminConfigurationFailure = Boolean(
    missingEnvironmentVariable
    || message.includes('FIREBASE_ADMIN_')
    || message.includes('Firebase emulator variables must be unset'),
  )
  const firebaseErrorCode = code && /^(auth|app)\/[a-z0-9-]+$/i.test(code) ? code : null
  const firebaseServiceUnavailable = firebaseErrorCode === 'app/network-error' || firebaseErrorCode === 'auth/network-request-failed'
  const apiErrorCode: ApiErrorCode = firebaseServiceUnavailable
    ? 'EXTERNAL_SERVICE_ERROR'
    : firebaseErrorCode?.startsWith('auth/') && !adminConfigurationFailure
      ? 'UNAUTHENTICATED'
      : 'INTERNAL_ERROR'

  return {
    code: projectMismatch
      ? 'FIREBASE_PROJECT_MISMATCH'
      : adminConfigurationFailure
        ? 'FIREBASE_ADMIN_MISCONFIGURED'
        : firebaseServiceUnavailable
          ? 'FIREBASE_SERVICE_UNAVAILABLE'
          : firebaseErrorCode?.startsWith('auth/')
            ? 'FIREBASE_ID_TOKEN_REJECTED'
            : 'SESSION_CREATION_FAILED',
    status: projectMismatch || adminConfigurationFailure ? 500 : firebaseServiceUnavailable ? 503 : firebaseErrorCode?.startsWith('auth/') ? 401 : 500,
    apiErrorCode,
    firebaseErrorCode,
    missingEnvironmentVariable: missingEnvironmentVariable
      ?? (projectMismatch ? 'FIREBASE_ADMIN_PROJECT_ID' : null)
      ?? (message.includes('FIREBASE_ADMIN_CLIENT_EMAIL') ? 'FIREBASE_ADMIN_CLIENT_EMAIL' : null)
      ?? (message.includes('FIREBASE_ADMIN_PRIVATE_KEY') ? 'FIREBASE_ADMIN_PRIVATE_KEY' : null),
  }
}

export async function POST(request: NextRequest) {
  try {
    const raw = await readJsonBody(request)
    const body = raw && typeof raw === 'object' ? raw as { idToken?: unknown } : {}
    if (typeof body.idToken !== 'string' || !body.idToken.trim()) {
      return NextResponse.json(apiError('VALIDATION_ERROR', 'Firebase ID token is required'), { status: 400 })
    }

    const sessionCookie = await createSessionCookie(body.idToken)
    const response = NextResponse.json({ data: { authenticated: true } })
    response.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    })
    return response
  } catch (error) {
    const failure = classifySessionFailure(error)
    console.error('[auth/session] Firebase session creation failed', {
      provider: 'firebase-admin',
      stage: 'create-session-cookie',
      firebaseErrorCode: failure.firebaseErrorCode,
      serverErrorCode: failure.code,
      configField: failure.missingEnvironmentVariable,
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID?.trim() || null,
      webProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || null,
      environment: process.env.NODE_ENV ?? 'unknown',
    })
    return NextResponse.json(
      apiError(
        failure.apiErrorCode,
        failure.status === 401 ? 'Unable to verify Firebase identity' : 'Unable to establish a server session',
        {
          code: failure.code,
          ...(failure.firebaseErrorCode ? { firebaseErrorCode: failure.firebaseErrorCode } : {}),
        },
      ),
      { status: failure.status },
    )
  }
}

export async function DELETE() {
  const response = NextResponse.json({ data: { authenticated: false } })
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, expires: new Date(0), path: '/' })
  return response
}
