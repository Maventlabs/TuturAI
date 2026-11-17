import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { consumeApiRateLimit, rateLimitResponse } from '@/lib/api/rate-limit'
import { AccessToken } from 'livekit-server-sdk'

export const runtime = 'nodejs'

const ROOM_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/

export async function POST(request: NextRequest) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  try {
    await consumeApiRateLimit({ scope: 'challenge-speaking-token', subject: auth.user.uid, limit: 20, windowMs: 60_000 })
  } catch (error) {
    const limited = rateLimitResponse(error)
    if (limited) return limited
    throw error
  }

  try {
    const body = await request.json().catch(() => ({}))
    const requestedRoom = typeof body?.roomName === 'string' ? body.roomName.trim() : ''

    if (requestedRoom && !ROOM_NAME_PATTERN.test(requestedRoom)) {
      return NextResponse.json(apiError('VALIDATION_ERROR', 'Nama room tidak valid.'), { status: 400 })
    }

    const roomName = requestedRoom || `room-${auth.user.uid.slice(0, 8)}-${Date.now()}`
    // The participant identity always comes from the verified session. Accepting a
    // client-supplied name would let one student mint a token that joins a room as
    // another participant.
    const identity = auth.user.uid
    const displayName = auth.profile.full_name ?? identity

    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL

    if (!apiKey || !apiSecret || !livekitUrl) {
      // Fallback to mock token for demo
      return NextResponse.json({
        data: {
          token: `mock-token-${roomName}-${identity}`,
          url: livekitUrl ?? 'wss://placeholder.livekit.cloud',
          roomName,
          isMock: true,
        },
      }, { status: 200 })
    }

    // Generate real LiveKit token
    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      ttl: '1h',
      name: displayName,
    })
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })

    const jwt = await token.toJwt()

    return NextResponse.json({
      data: {
        token: jwt,
        url: livekitUrl,
        roomName,
        isMock: false,
      },
    }, { status: 200 })
  } catch (error) {
    console.error('LiveKit token error:', error)
    return NextResponse.json(
      apiError('INTERNAL_ERROR', 'Gagal membuat token room. Coba lagi.'),
      { status: 500 },
    )
  }
}
