import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/auth-guard'
import { getAdminDb } from '@/lib/firebase/admin'
import { listTeacherClassrooms, listTeacherClassroomMembers } from '@/lib/classrooms'
import { buildTeacherLeaderboard, type TeacherLeaderboardInput } from '@/lib/teacher-leaderboard'

export async function GET() {
  const auth = await requireRole('teacher')
  if (!auth.ok) return auth.response

  const db = getAdminDb()
  const classrooms = await listTeacherClassrooms(auth.user.uid)
  const membersByClassroom = await Promise.all(classrooms.map((classroom) => listTeacherClassroomMembers(classroom.id, auth.user.uid)))
  const rows = membersByClassroom.flatMap((members, index) => members.map((member) => ({ member, classroom: classrooms[index] })))
  const userSnapshots = rows.length ? await db.getAll(...rows.map(({ member }) => db.collection('users').doc(member.studentId))) : []
  const assessments = await Promise.all([...new Set(rows.map(({ member }) => member.studentId))].map((studentId) => db.collection('assessments').where('studentId', '==', studentId).limit(100).get()))
  const scoreByStudent = new Map<string, number[]>()
  for (const snapshot of assessments) {
    for (const doc of snapshot.docs) {
      const data = doc.data()
      if (typeof data.overall !== 'number' || data.overall < 0 || data.overall > 100) continue
      const scores = scoreByStudent.get(data.studentId) ?? []
      scores.push(data.overall)
      scoreByStudent.set(data.studentId, scores)
    }
  }
  const userById = new Map(userSnapshots.map((snapshot) => [snapshot.id, snapshot.data() ?? {}]))
  const leaderboardRows: TeacherLeaderboardInput[] = rows.map(({ member, classroom }) => {
    const user = userById.get(member.studentId) ?? {}
    const scores = scoreByStudent.get(member.studentId) ?? []
    return {
      studentId: member.studentId,
      name: member.name,
      classId: classroom.id,
      className: classroom.name,
      xp: typeof user.xp === 'number' && user.xp >= 0 ? user.xp : 0,
      speakingScore: scores.length ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length) : null,
    }
  })

  return NextResponse.json({ data: buildTeacherLeaderboard(leaderboardRows) })
}
