import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { apiError, validateNewsletterInput } from '@tuturai/validation'
import { getAdminDb } from '@/lib/firebase/admin'
import { consumeApiRateLimit, rateLimitResponse } from '@/lib/api/rate-limit'
import { readJsonBody } from '@/lib/api/request'
import { getRequestId } from '@/lib/api/observability'

export const dynamic = 'force-dynamic'

function clientIp(request: NextRequest) {
  const netlifyIp = request.headers.get('x-nf-client-connection-ip')?.trim()
  if (netlifyIp) return netlifyIp
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    await consumeApiRateLimit({
      scope: 'newsletter',
      subject: clientIp(request),
      limit: 5,
      windowMs: 60 * 60 * 1000,
    })
  } catch (cause) {
    const limited = rateLimitResponse(cause)
    if (limited) return limited
    throw cause
  }

  const validation = validateNewsletterInput(await readJsonBody(request))
  if (!validation.success) {
    return NextResponse.json(
      apiError('VALIDATION_ERROR', validation.issues[0]?.message ?? 'Invalid input', undefined, requestId),
      { status: 400, headers: { 'cache-control': 'no-store' } },
    )
  }

  const { email } = validation.data
  const reference = getAdminDb()
    .collection('newsletterSubscribers')
    .doc(createHash('sha256').update(email).digest('hex'))
  const now = Timestamp.now()
  const existing = await reference.get()

  if (existing.exists) {
    await reference.update({ updatedAt: now })
  } else {
    await reference.create({ email, source: 'landing-footer', createdAt: now, updatedAt: now })
  }

  return NextResponse.json(
    { data: { subscribed: true } },
    { status: 201, headers: { 'cache-control': 'no-store' } },
  )
}
