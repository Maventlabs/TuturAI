import { AudioLines, BookText, Headphones, ListChecks, Mic, Route } from 'lucide-react'
import { PracticeCard, type PracticeMode } from '@/components/student/learning/practice-card'

export const metadata = {
  title: 'Learning · TuturAI',
  description: 'Enam mode latihan speaking, pronunciation, vocabulary, listening, quiz, dan jalur adaptif.',
}

const MODES: PracticeMode[] = [
  {
    index: '01',
    label: 'Speaking Practice',
    href: '/siswa/speaking',
    icon: Mic,
    meta: 'Rekam & dinilai AI',
    desc: 'Latihan bicara bebas dengan penilaian lima dimensi linguistik.',
    action: 'Mulai rekaman',
    image: '/learning/speaking.webp',
    imageAlt: 'Mikrofon kondensor di dalam studio rekaman',
  },
  {
    index: '02',
    label: 'Pronunciation Lab',
    href: '/siswa/pronunciation',
    icon: AudioLines,
    meta: 'Fonem & intonasi',
    desc: 'Latih bunyi yang sering keliru, tanpa skor yang mengarang.',
    action: 'Latih bunyi',
    image: '/learning/pronunciation.webp',
    imageAlt: 'Mikrofon pada dudukan dengan latar gelap',
  },
  {
    index: '03',
    label: 'Vocabulary',
    href: '/siswa/vocabulary',
    icon: BookText,
    meta: 'Kartu kata adaptif',
    desc: 'Kartu kata Easy, Medium, dan Hard yang menyesuaikan levelmu.',
    action: 'Buka kartu',
    image: '/learning/vocabulary.webp',
    imageAlt: 'Buku terbuka dengan halaman yang tersusun',
  },
  {
    index: '04',
    label: 'Listening',
    href: '/siswa/listening',
    icon: Headphones,
    meta: 'Audio bertingkat',
    desc: 'Audio bertingkat dengan transkrip yang terbuka bertahap.',
    action: 'Putar audio',
    image: '/learning/listening.webp',
    imageAlt: 'Headphone over-ear di atas permukaan terang',
  },
  {
    index: '05',
    label: 'Quiz',
    href: '/siswa/quiz',
    icon: ListChecks,
    meta: 'Kuis terpadu',
    desc: 'Kuis campuran untuk mengukur kesiapan sebelum penilaian guru.',
    action: 'Mulai kuis',
    image: '/learning/quiz.webp',
    imageAlt: 'Catatan tulisan tangan dengan pena di atas meja',
  },
  {
    index: '06',
    label: 'Adaptive Path',
    href: '/siswa/adaptive',
    icon: Route,
    meta: 'Modul sesuai level',
    desc: 'Modul yang dipilih dari histori jawabanmu, bukan dari urutan acak.',
    action: 'Buka modul',
    image: '/learning/adaptive.webp',
    imageAlt: 'Punggungan gunung berkabut yang membentang ke kejauhan',
  },
]

export default function LearningHubPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <header className="border-b border-rule pb-7">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Learning
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            06 mode · 01 jalur
          </p>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-end lg:gap-10">
          <h1 className="text-balance font-display text-[2.25rem] leading-[1.05] tracking-[-0.02em] text-foreground sm:text-[2.9rem]">
            Pilih cara kamu berlatih hari ini.
          </h1>
          <p className="text-pretty text-[14px] leading-relaxed text-muted-foreground lg:pb-1.5">
            Enam mode latihan, satu jalur adaptif. Semua hasil masuk ke progres dan klasemen kelasmu.
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {MODES.map((mode) => (
          <PracticeCard key={mode.href} mode={mode} />
        ))}
      </div>
    </div>
  )
}
