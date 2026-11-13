import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { HEARTBEAT_INTERVAL_SECONDS, ONLINE_WINDOW_MS, serializeDevice, verifyDeviceSecret } from '@/lib/devices'
import { getAdminDb } from '@/lib/firebase/admin'

/**
 * Device-authenticated read of the device's own record. The firmware uses it to
 * confirm it is still paired and to learn the heartbeat cadence.
 */
export async function GET(request: NextRequest) {
  const deviceId = request.headers.get('x-device-id')?.trim() ?? ''
  const secret = request.headers.get('x-device-secret') ?? ''
  if (!deviceId || !secret) {
    return NextResponse.json(apiError('UNAUTHENTICATED', 'Device credentials are invalid'), { status: 401 })
  }

  const snapshot = await getAdminDb().collection('devices').doc(deviceId).get()
  if (!snapshot.exists) {
    return NextResponse.json(apiError('UNAUTHENTICATED', 'Device credentials are invalid'), { status: 401 })
  }

  const data = snapshot.data() ?? {}
  const storedHash = data.credentialHash
  if (data.revokedAt != null || typeof storedHash !== 'string' || !(await verifyDeviceSecret(secret, storedHash))) {
    return NextResponse.json(apiError('UNAUTHENTICATED', 'Device credentials are invalid'), { status: 401 })
  }

  const device = serializeDevice(snapshot.id, data)
  return NextResponse.json({
    data: {
      deviceId: device.id,
      status: device.status,
      battery: device.battery,
      signal: device.signal,
      firmware: device.firmware,
      lastSyncAt: device.lastSyncAt,
      pairedAt: device.pairedAt,
      serverTime: new Date().toISOString(),
      heartbeatIntervalSeconds: HEARTBEAT_INTERVAL_SECONDS,
      offlineAfterSeconds: Math.round(ONLINE_WINDOW_MS / 1000),
    },
  })
}
