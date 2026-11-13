'use client'

import { ClassroomBody, useClassroom } from '@/components/guru/classroom-context'
import { GradesPanel } from '@/components/guru/grades-panel'

export default function ClassroomGradesPage() {
  return (
    <ClassroomBody>
      {(snapshot) => <GradesPanel assignments={snapshot.assignments} members={snapshot.members} />}
    </ClassroomBody>
  )
}
