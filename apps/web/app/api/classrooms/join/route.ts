import { NextRequest, NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { canJoinClassroom, validateJoinKey } from '@tuturai/domain'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { consumeJoinAttempt, hashJoinKey } from '@/lib/classrooms'
import { getAdminDb } from '@/lib/firebase/admin'
import { readJsonBody } from '@/lib/api/request'

export async function POST(request: NextRequest) {
  const auth = await requireRole('student')
  if (!auth.ok) return auth.response

  try {
    await consumeJoinAttempt(auth.user.uid)
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'JOIN_RATE_LIMITED') {
      return NextResponse.json(apiError('RATE_LIMITED', 'Too many join attempts. Try again later.'), { status: 429 })
    }
    throw cause
  }

  const body = await readJsonBody(request)
  const validation = validateJoinKey(body && typeof body === 'object' ? (body as { joinKey?: unknown }).joinKey : undefined)
  if (!validation.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', validation.message), { status: 400 })
  }

  const classroomSnapshot = await getAdminDb()
    .collection('classrooms')
    .where('joinKeyHash', '==', hashJoinKey(validation.value))
    .limit(1)
    .get()
  const classroom = classroomSnapshot.docs[0]
  if (!classroom) return NextResponse.json(apiError('NOT_FOUND', 'Classroom was not found'), { status: 404 })

  const data = classroom.data()
  const membershipReference = getAdminDb().collection('classMemberships').doc(`${classroom.id}_${auth.user.uid}`)
  const existingMembership = await membershipReference.get()
  if (!canJoinClassroom({
    role: auth.profile.role,
    classroomStatus: data.status,
    joinKeyRevoked: data.joinKeyRevoked === true,
    alreadyMember: existingMembership.exists,
  })) {
    return NextResponse.json(apiError('CONFLICT', 'You cannot join this classroom'), { status: 409 })
  }

  const now = Timestamp.now()
  try {
    await membershipReference.create({ classId: classroom.id, studentId: auth.user.uid, status: 'active', joinedAt: now })
  } catch (cause) {
    if (cause instanceof Error && /already exists|ALREADY_EXISTS/i.test(cause.message)) {
      return NextResponse.json(apiError('CONFLICT', 'You are already a member of this classroom'), { status: 409 })
    }
    throw cause
  }
  return NextResponse.json({ data: { id: classroom.id, name: data.name } }, { status: 201 })
}
