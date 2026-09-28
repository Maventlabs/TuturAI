import { NextResponse } from 'next/server'
import { apiError } from '@tuturai/validation'
import { requireRole } from '@/lib/api/auth-guard'
import { listTeacherClassroomMembers, listTeacherClassrooms } from '@/lib/classrooms'

type RouteContext = { params: Promise<{ studentId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response

  const { studentId } = await context.params
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(studentId)) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Student ID is invalid'), { status: 400 })
  }

  const classrooms = (await listTeacherClassrooms(auth.user.uid)).filter((classroom) => classroom.status === 'active')
  const membershipSets = await Promise.all(
    classrooms.map(async (classroom) => ({
      classroom,
      members: await listTeacherClassroomMembers(classroom.id, auth.user.uid),
    })),
  )
  const ownedMemberships = membershipSets.flatMap(({ classroom, members }) => {
    const member = members.find((candidate) => candidate.studentId === studentId)
    return member ? [{ classroomId: classroom.id, classroomName: classroom.name, member }] : []
  })
  if (ownedMemberships.length === 0) {
    return NextResponse.json(apiError('NOT_FOUND', 'Student was not found in a classroom managed by this teacher'), { status: 404 })
  }

  const student = ownedMemberships[0].member
  return NextResponse.json({
    data: {
      student: {
        id: student.studentId,
        name: student.name,
        email: student.email,
        level: student.level,
        streak: student.streak,
        speakingScore: student.speakingScore,
      },
      classrooms: ownedMemberships.map(({ classroomId, classroomName, member }) => ({
        id: classroomId,
        name: classroomName,
        joinedAt: member.joinedAt,
      })),
    },
  })
}
