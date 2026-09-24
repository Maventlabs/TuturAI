import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { createDeviceSecret, hashDeviceSecret, isValidDeviceId, listTeacherDevices, registerDevice, revokeDevice } from '@/lib/devices'
import { getAdminDb } from '@/lib/firebase/admin'

export async function GET() {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response
  return NextResponse.json({ data: await listTeacherDevices(auth.user.uid) })
}

export async function POST(request: NextRequest) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => null) as { deviceId?: unknown; classroomId?: unknown } | null
  const deviceId = typeof body?.deviceId === 'string' ? body.deviceId.trim() : ''
  const classroomId = typeof body?.classroomId === 'string' && body.classroomId.trim() ? body.classroomId.trim() : null
  if (!isValidDeviceId(deviceId)) return NextResponse.json(apiError('VALIDATION_ERROR', 'Device ID must be 4-64 safe characters'), { status: 400 })
  try {
    if (classroomId) {
      const classroom = await getAdminDb().collection('classrooms').doc(classroomId).get()
      if (!classroom.exists || classroom.data()?.teacherId !== auth.user.uid || classroom.data()?.status !== 'active') {
        return NextResponse.json(apiError('FORBIDDEN', 'Classroom is not owned by this teacher'), { status: 403 })
      }
    }
    const secret = createDeviceSecret()
    const device = await registerDevice({ deviceId, teacherId: auth.user.uid, classroomId, secretHash: await hashDeviceSecret(secret) })
    return NextResponse.json({ data: { device, secret } }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'DEVICE_ALREADY_REGISTERED') return NextResponse.json(apiError('CONFLICT', 'Device is already registered'), { status: 409 })
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
