import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { createSessionCookie, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/firebase/session'
import { readJsonBody } from '@/lib/api/request'

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
  } catch {
    return NextResponse.json(apiError('UNAUTHENTICATED', 'Unable to establish a session'), { status: 401 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ data: { authenticated: false } })
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, expires: new Date(0), path: '/' })
  return response
}
