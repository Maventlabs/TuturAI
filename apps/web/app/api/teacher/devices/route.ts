import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import {
  PAIRING_TTL_MS,
  createDeviceId,
  createPairingCode,
  hashPairingCode,
  isValidDeviceId,
  issuePairingCode,
  listTeacherDevices,
  registerDevice,
  revokeDevice,
} from '@/lib/devices'
import { getAdminDb } from '@/lib/firebase/admin'

export async function GET() {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response
  return NextResponse.json({ data: await listTeacherDevices(auth.user.uid) })
}

/**
 * Creates a device, or re-issues a pairing code for one that has not been
 * claimed yet. The device credential is never returned here: the firmware
 * exchanges the pairing code for its own secret at /api/device/pair.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null) as { deviceId?: unknown; label?: unknown; classroomId?: unknown } | null
  const requestedId = typeof body?.deviceId === 'string' ? body.deviceId.trim() : ''
  const label = typeof body?.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 60) : null
  const classroomId = typeof body?.classroomId === 'string' && body.classroomId.trim() ? body.classroomId.trim() : null

  if (requestedId && !isValidDeviceId(requestedId)) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Device ID must be 4-64 safe characters'), { status: 400 })
  }

  if (classroomId) {
    const classroom = await getAdminDb().collection('classrooms').doc(classroomId).get()
    if (!classroom.exists || classroom.data()?.teacherId !== auth.user.uid || classroom.data()?.status !== 'active') {
      return NextResponse.json(apiError('FORBIDDEN', 'Classroom is not owned by this teacher'), { status: 403 })
    }
  }

  const code = createPairingCode()
  const pairingCodeHash = await hashPairingCode(code)
  const pairingExpiresAt = new Date(Date.now() + PAIRING_TTL_MS)
  const deviceId = requestedId || createDeviceId()

  try {
    let device
    let status = 201

    if (requestedId) {
      try {
        device = await issuePairingCode(deviceId, auth.user.uid, { pairingCodeHash, pairingExpiresAt })
        status = 200
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'DEVICE_NOT_FOUND') throw error
        device = await registerDevice({ deviceId, teacherId: auth.user.uid, classroomId, label, pairingCodeHash, pairingExpiresAt })
      }
    } else {
      device = await registerDevice({ deviceId, teacherId: auth.user.uid, classroomId, label, pairingCodeHash, pairingExpiresAt })
    }

    return NextResponse.json(
      { data: { device, pairing: { code, expiresAt: pairingExpiresAt.toISOString() } } },
      { status },
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'DEVICE_ALREADY_REGISTERED') {
      return NextResponse.json(apiError('CONFLICT', 'Device is already registered'), { status: 409 })
    }
    if (error instanceof Error && error.message === 'DEVICE_ALREADY_PAIRED') {
      return NextResponse.json(apiError('CONFLICT', 'Device is already paired. Revoke it before pairing again.'), { status: 409 })
    }
    if (error instanceof Error && error.message === 'DEVICE_REVOKED') {
      return NextResponse.json(apiError('CONFLICT', 'Device was revoked and cannot be paired again'), { status: 409 })
    }
    throw error
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response
  const deviceId = new URL(request.url).searchParams.get('deviceId')?.trim() ?? ''
  if (!isValidDeviceId(deviceId)) return NextResponse.json(apiError('VALIDATION_ERROR', 'Device ID is required'), { status: 400 })
  try {
    await revokeDevice(deviceId, auth.user.uid)
    return NextResponse.json({ data: { id: deviceId, status: 'revoked' } })
  } catch (error) {
    if (error instanceof Error && error.message === 'DEVICE_NOT_FOUND') return NextResponse.json(apiError('NOT_FOUND', 'Device was not found'), { status: 404 })
    throw error
  }
}
