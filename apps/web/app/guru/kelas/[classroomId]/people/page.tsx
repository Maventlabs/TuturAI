'use client'

import { classBandColor } from '@/lib/class-tint'
import { ClassroomBody, useClassroom } from '@/components/guru/classroom-context'
import { useTeacherName } from '@/components/guru/use-classroom-overview'
import { PeoplePanel } from '@/components/guru/people-panel'

export default function ClassroomPeoplePage() {
  const { removingId, memberError, removeMember } = useClassroom()
  const teacherName = useTeacherName()

  return (
    <ClassroomBody>
      {(snapshot) => (
        <PeoplePanel
          members={snapshot.members}
          teacherName={teacherName}
          band={classBandColor(snapshot.classroom.id)}
          removingId={removingId}
          memberError={memberError}
          onRemove={removeMember}
        />
      )}
    </ClassroomBody>
  )
}
