'use client'

import { PracticeHeader } from '@/components/student/practice/practice-ui'
import { VocabularyQuiz } from '@/components/student/vocabulary-quiz'

export default function VocabularyPage() {
  return (
    <div className="space-y-6">
      <PracticeHeader
        eyebrow="Latihan / Vocabulary"
        title="Vocabulary"
        description="Tiga level, dua puluh kata per sesi. Pilih level, tentukan arti yang benar, dan setiap jawaban dicatat server sebagai kata yang sudah dikuasai."
        meta={[
          { label: 'Level', value: 3 },
          { label: 'Kata / sesi', value: 20 },
          { label: 'Format', value: 'Pilihan ganda' },
        ]}
      />
      <VocabularyQuiz />
    </div>
  )
}
