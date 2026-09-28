import { NextResponse } from 'next/server'
import { getRequestId } from '@/lib/api/observability'

export async function GET(request: Request) {
  const requestId = getRequestId(request)
  return NextResponse.json({
    data: {
      status: 'ok',
      service: 'tuturai-web',
      runtime: process.env.NETLIFY ? 'netlify' : 'node',
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
