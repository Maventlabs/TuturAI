import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { HEARTBEAT_INTERVAL_SECONDS, ONLINE_WINDOW_MS, claimDevice, normalizePairingCode } from '@/lib/devices'

/**
 * Called by the ESP32 firmware with the code shown on the teacher dashboard.
 * A successful claim returns the device ID and the secret the firmware stores
 * in NVS; the code itself is single-use and expires after 15 minutes.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { code?: unknown; hardwareId?: unknown; firmware?: unknown } | null
  const rawCode = typeof body?.code === 'string' ? body.code : ''

  if (!normalizePairingCode(rawCode)) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Pairing code must be 6 characters'), { status: 400 })
  }

  const hardwareId = typeof body?.hardwareId === 'string' && body.hardwareId.trim() ? body.hardwareId.trim().slice(0, 64) : null
  const firmware = typeof body?.firmware === 'string' && body.firmware.trim() ? body.firmware.trim().slice(0, 64) : null

  const result = await claimDevice({ code: rawCode, hardwareId, firmware })

  if (!result.ok) {
    if (result.reason === 'expired') {
      return NextResponse.json(
        apiError('VALIDATION_ERROR', 'Pairing code expired. Generate a new code from the teacher dashboard.'),
        { status: 410 },
      )
    }
    return NextResponse.json(apiError('UNAUTHENTICATED', 'Pairing code is not recognised'), { status: 401 })
  }

  return NextResponse.json({
    data: {
      deviceId: result.deviceId,
      secret: result.secret,
      heartbeatIntervalSeconds: HEARTBEAT_INTERVAL_SECONDS,
      offlineAfterSeconds: Math.round(ONLINE_WINDOW_MS / 1000),
      heartbeatUrl: '/api/device/heartbeat',
      statusUrl: '/api/device/status',
    },
  })
}
