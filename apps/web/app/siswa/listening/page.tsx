'use client'

import { PracticeHeader } from '@/components/student/practice/practice-ui'
import { ListeningTest } from '@/components/student/listening-test'

export default function ListeningPage() {
  return (
    <div className="space-y-6">
      <PracticeHeader
        eyebrow="Latihan / Listening"
        title="Listening Comprehension"
        description="Sekali dengar, tanpa ulang. Pilih level, dengarkan audio sampai selesai, lalu jawab pertanyaan yang muncul satu per satu."
        meta={[
          { label: 'Level', value: 3 },
          { label: 'Putar', value: '1×' },
          { label: 'Skor', value: 'Server' },
        ]}
      />
      <ListeningTest />
    </div>
  )
}
