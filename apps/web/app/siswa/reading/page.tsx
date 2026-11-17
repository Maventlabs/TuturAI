import { PracticeHeader } from '@/components/student/practice/practice-ui'
import { ReadingConsole } from '@/components/student/reading/reading-console'

export const metadata = {
  title: 'Reading',
  description: 'Latihan reading bergaya IELTS: dua passage, sepuluh pertanyaan, tiga level, dengan pembahasan per soal.',
}

export default function ReadingPage() {
  return (
    <div className="space-y-6">
      <PracticeHeader
        eyebrow="Latihan / Reading"
        title="Reading Comprehension"
        description="Dua passage, sepuluh pertanyaan, satu level. Selesaikan passage pertama sebelum membuka passage kedua; skor dan pembahasan dihitung server."
        meta={[
          { label: 'Level', value: 3 },
          { label: 'Passage', value: 2 },
          { label: 'Soal', value: 10 },
        ]}
      />
      <ReadingConsole />
    </div>
  )
}
