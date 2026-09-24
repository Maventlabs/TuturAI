import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { getDevice, updateDeviceHeartbeat, verifyDeviceSecret } from '@/lib/devices'
import { getAdminDb } from '@/lib/firebase/admin'

export async function POST(request: NextRequest) {
  const deviceId = request.headers.get('x-device-id')?.trim() ?? ''
  const secret = request.headers.get('x-device-secret') ?? ''
  const device = await getDevice(deviceId)
  if (!device || !secret) return NextResponse.json(apiError('UNAUTHENTICATED', 'Device credentials are invalid'), { status: 401 })
  const raw = await request.json().catch(() => null) as { battery?: unknown; signal?: unknown; firmware?: unknown } | null
  const battery = raw?.battery === undefined ? undefined : Number(raw.battery)
  const signal = raw?.signal === undefined ? undefined : Number(raw.signal)
  const firmware = raw?.firmware === undefined ? undefined : String(raw.firmware).slice(0, 64)
  if ((battery !== undefined && (!Number.isInteger(battery) || battery < 0 || battery > 100)) || (signal !== undefined && (!Number.isInteger(signal) || signal < 0 || signal > 100))) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Telemetry values are out of range'), { status: 400 })
  }
  const snapshot = await getAdminDb().collection('devices').doc(deviceId).get()
  const storedHash = snapshot.data()?.credentialHash
  if (typeof storedHash !== 'string' || !(await verifyDeviceSecret(secret, storedHash))) return NextResponse.json(apiError('UNAUTHENTICATED', 'Device credentials are invalid'), { status: 401 })
  try {
    await updateDeviceHeartbeat(deviceId, { battery, signal, firmware })
    return NextResponse.json({ data: { accepted: true } })
  } catch (error) {
    if (error instanceof Error && error.message === 'DEVICE_NOT_FOUND') return NextResponse.json(apiError('NOT_FOUND', 'Device is not registered'), { status: 404 })
    throw error
  }
}
