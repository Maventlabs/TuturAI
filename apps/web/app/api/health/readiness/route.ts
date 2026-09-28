import { NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { getFirebaseAdminEnv } from '@/lib/config/env'
import { getAdminDb } from '@/lib/firebase/admin'
import { getRequestId, logApiFailure } from '@/lib/api/observability'

function configuredProvider(routeKey: string, modelKey: string, defaultRoute: 'v1' | 'local') {
  const route = process.env[routeKey]?.trim() || defaultRoute
  const prefix = route === 'local' ? 'AI_LOCAL' : 'AI_V1'
  const baseConfigured = Boolean(process.env[`${prefix}_BASE_URL`]?.trim())
  const modelConfigured = Boolean(process.env[modelKey]?.trim())
  return baseConfigured && modelConfigured ? 'configured' : 'not_configured'
}

export async function GET(request: Request) {
  const startedAt = performance.now()
  const requestId = getRequestId(request)
  let auth: Awaited<ReturnType<typeof requireRole>>
  try {
    auth = await requireRole('teacher')
  } catch {
    logApiFailure({
      requestId,
      route: '/api/health/readiness',
      status: 503,
      errorCode: 'FIREBASE_AUTH_UNAVAILABLE',
      provider: 'firebase-admin',
      durationMs: performance.now() - startedAt,
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID?.trim() || null,
    })
    return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Readiness check failed', {
      code: 'FIREBASE_AUTH_UNAVAILABLE',
      requestId,
    }), {
      status: 503,
      headers: { 'cache-control': 'no-store', 'x-request-id': requestId },
    })
  }
  if (!auth.ok) return auth.response

  try {
    const firebase = getFirebaseAdminEnv()
    await getAdminDb().collection('_health').limit(1).get()
    return NextResponse.json({
      data: {
        status: 'ready',
        requestId,
        firebase: {
          projectId: firebase.projectId,
          auth: 'reachable',
          firestore: 'reachable',
        },
        optionalProviders: {
          stt: configuredProvider('AI_STT_ROUTE', 'AI_STT_MODEL_ID', 'v1'),
          llm: configuredProvider('AI_LLM_ROUTE', 'AI_LLM_MODEL_ID', 'v1'),
          voice: configuredProvider('AI_TTS_ROUTE', 'AI_TTS_MODEL_ID', 'local'),
        },
        checkedAt: new Date().toISOString(),
      },
    }, {
      headers: { 'cache-control': 'no-store', 'x-request-id': requestId },
    })
  } catch {
    logApiFailure({
      requestId,
      route: '/api/health/readiness',
      status: 503,
      errorCode: 'FIRESTORE_UNAVAILABLE',
      provider: 'firebase-admin',
      durationMs: performance.now() - startedAt,
    })
    return NextResponse.json(apiError('EXTERNAL_SERVICE_ERROR', 'Readiness check failed', {
      code: 'FIRESTORE_UNAVAILABLE',
      requestId,
    }), {
      status: 503,
      headers: { 'cache-control': 'no-store', 'x-request-id': requestId },
    })
  }
}
