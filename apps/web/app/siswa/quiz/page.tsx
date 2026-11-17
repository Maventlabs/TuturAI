import { PracticeHeader } from '@/components/student/practice/practice-ui'
import { QuizConsole } from '@/components/student/quiz/quiz-console'

export default function QuizPage() {
  return (
    <div className="space-y-6">
      <PracticeHeader
        eyebrow="Latihan / Quiz"
        title="Ujian Terintegrasi"
        description="Satu ujian 30 soal untuk tiga kemampuan sekaligus: Reading Comprehension, Listening Comprehension, dan General Questions. Pilih level, baca instruksi, lalu mulai — timer 30 menit baru berjalan setelah kamu menekan tombol mulai."
        meta={[
          { label: 'Soal', value: 30 },
          { label: 'Durasi', value: 30, unit: 'menit' },
          { label: 'Section', value: 3 },
        ]}
      />
      <QuizConsole />
    </div>
  )
}
