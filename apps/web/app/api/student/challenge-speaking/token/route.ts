import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { AccessToken } from 'livekit-server-sdk'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const roomName = body.roomName ?? `room-${Date.now()}`
    const participantName = body.participantName ?? auth.user.uid

    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL

    if (!apiKey || !apiSecret || !livekitUrl) {
      // Fallback to mock token for demo
      return NextResponse.json({
        data: {
          token: `mock-token-${roomName}-${participantName}`,
          url: livekitUrl ?? 'wss://placeholder.livekit.cloud',
          roomName,
          isMock: true,
        },
      }, { status: 200 })
    }

    // Generate real LiveKit token
    const token = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      ttl: '1h',
      name: participantName,
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
