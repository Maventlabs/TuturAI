import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import {
  HEARTBEAT_INTERVAL_SECONDS,
  ONLINE_WINDOW_MS,
  getDevice,
  parseDeviceHeartbeat,
  updateDeviceHeartbeat,
  verifyDeviceSecret,
} from '@/lib/devices'
import { getAdminDb } from '@/lib/firebase/admin'

export async function POST(request: NextRequest) {
  const deviceId = request.headers.get('x-device-id')?.trim() ?? ''
  const secret = request.headers.get('x-device-secret') ?? ''
  const device = await getDevice(deviceId)
  if (!device || !secret) return NextResponse.json(apiError('UNAUTHENTICATED', 'Device credentials are invalid'), { status: 401 })
  const telemetry = parseDeviceHeartbeat(await request.json().catch(() => null))
  if (!telemetry) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Telemetry values are out of range'), { status: 400 })
  }
  const snapshot = await getAdminDb().collection('devices').doc(deviceId).get()
  const stored = snapshot.data() ?? {}
  const storedHash = stored.credentialHash
  if (stored.revokedAt != null) return NextResponse.json(apiError('UNAUTHENTICATED', 'Device credentials are invalid'), { status: 401 })
  if (typeof storedHash !== 'string' || !(await verifyDeviceSecret(secret, storedHash))) return NextResponse.json(apiError('UNAUTHENTICATED', 'Device credentials are invalid'), { status: 401 })
  try {
    await updateDeviceHeartbeat(deviceId, telemetry, stored)
    return NextResponse.json({
      data: {
        accepted: true,
        status: 'online',
        serverTime: new Date().toISOString(),
        heartbeatIntervalSeconds: HEARTBEAT_INTERVAL_SECONDS,
        offlineAfterSeconds: Math.round(ONLINE_WINDOW_MS / 1000),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'DEVICE_NOT_FOUND') return NextResponse.json(apiError('NOT_FOUND', 'Device is not registered'), { status: 404 })
    throw error
  }
}
