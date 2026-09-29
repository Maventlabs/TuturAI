import { NextResponse } from 'next/server'
import { getRequestId } from '@/lib/api/observability'

// Always execute at request time on the server runtime: a prerendered health
// response would report the BUILD machine's Node version, not the Functions
// runtime's, which hid a runtime-version mismatch in production before.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const requestId = getRequestId(request)
  let firebaseAdminModule: 'loaded' | 'failed' = 'loaded'
  let firebaseAdminError: string | null = null
  try {
    await import('firebase-admin/app')
  } catch (cause) {
    firebaseAdminModule = 'failed'
    firebaseAdminError = cause instanceof Error ? cause.message.slice(0, 200) : 'unknown'
  }

  return NextResponse.json({
    data: {
      status: 'ok',
      service: 'tuturai-web',
      runtime: process.env.NETLIFY ? 'netlify' : 'node',
      nodeVersion: process.version,
      firebaseAdminModule,
      ...(firebaseAdminError ? { firebaseAdminError } : {}),
      dependencies: 'not_checked',
      requestId,
      timestamp: new Date().toISOString(),
    },
  }, {
    headers: {
      'cache-control': 'no-store',
      'x-request-id': requestId,
    },
  })
}
