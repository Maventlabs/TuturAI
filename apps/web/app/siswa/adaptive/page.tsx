'use client'

import { PracticeHeader } from '@/components/student/practice/practice-ui'
import { AdaptiveMap } from '@/components/student/adaptive-map'

export default function AdaptivePage() {
  return (
    <div className="space-y-6">
      <PracticeHeader
        eyebrow="Latihan / Adaptive"
        title="Adaptive Learning Path"
        description="Diagnosa empat aspek dari data latihanmu, lalu ikuti jalur modul yang terbuka bertahap. Level hanya tampil bila datanya cukup."
        meta={[
          { label: 'Aspek', value: 4 },
          { label: 'Min. sesi', value: 3 },
          { label: 'Sumber', value: 'Data latihan' },
        ]}
      />
      <AdaptiveMap />
    </div>
  )
}
