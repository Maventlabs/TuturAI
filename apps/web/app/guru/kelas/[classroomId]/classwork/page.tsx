'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ClassroomBody, useClassroom } from '@/components/guru/classroom-context'
import { ClassworkPanel, type ComposerKind } from '@/components/guru/classwork-panel'

function ClassworkContent() {
  const { classroomId, refresh } = useClassroom()
  const searchParams = useSearchParams()
  const [composer, setComposer] = useState<ComposerKind | null>(() => {
    const requested = searchParams.get('compose')
    return requested === 'assignment' || requested === 'material' ? requested : null
  })

  return (
    <ClassroomBody>
      {(snapshot) => (
        <ClassworkPanel
          classroomId={classroomId}
          assignments={snapshot.assignments}
          materials={snapshot.materials}
          composer={composer}
          onComposerChange={setComposer}
          onRefresh={refresh}
        />
      )}
    </ClassroomBody>
  )
}

export default function ClassroomClassworkPage() {
  return (
    <Suspense fallback={null}>
      <ClassworkContent />
    </Suspense>
  )
}
