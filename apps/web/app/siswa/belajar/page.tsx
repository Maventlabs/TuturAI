import Link from 'next/link'
import {
  ArrowUpRight,
  AudioLines,
  BookText,
  Headphones,
  ListChecks,
  Mic,
  Route,
} from 'lucide-react'

export const metadata = {
  title: 'Learning · TuturAI',
  description: 'Enam mode latihan speaking, pronunciation, vocabulary, listening, quiz, dan jalur adaptif.',
}

const MODES = [
  {
    label: 'Speaking Practice',
    href: '/siswa/speaking',
    icon: Mic,
    meta: 'Rekam & dinilai AI',
    desc: 'Latihan bicara bebas dengan penilaian lima dimensi linguistik.',
  },
  {
    label: 'Pronunciation Lab',
    href: '/siswa/pronunciation',
    icon: AudioLines,
    meta: 'Fonem & intonasi',
    desc: 'Latih bunyi yang sering keliru, tanpa skor yang mengarang.',
  },
  {
    label: 'Vocabulary',
    href: '/siswa/vocabulary',
    icon: BookText,
    meta: 'Kartu kata adaptif',
    desc: 'Kartu kata Easy, Medium, dan Hard yang menyesuaikan levelmu.',
  },
  {
    label: 'Listening',
    href: '/siswa/listening',
    icon: Headphones,
    meta: 'Audio bertingkat',
    desc: 'Audio bertingkat dengan transkrip yang terbuka bertahap.',
  },
  {
    label: 'Quiz',
    href: '/siswa/quiz',
    icon: ListChecks,
    meta: 'Kuis terpadu',
    desc: 'Kuis campuran untuk mengukur kesiapan sebelum penilaian guru.',
  },
  {
    label: 'Adaptive Path',
    href: '/siswa/adaptive',
    icon: Route,
    meta: 'Modul sesuai level',
    desc: 'Modul yang dipilih dari histori jawabanmu, bukan dari urutan acak.',
  },
]

export default function LearningHubPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <header className="border-b border-rule pb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Learning</p>
        <h1 className="mt-3 text-balance font-display text-[2.25rem] leading-[1.08] tracking-[-0.02em] text-foreground sm:text-[2.75rem]">
          Pilih cara kamu berlatih hari ini.
        </h1>
        <p className="mt-3 max-w-lg text-pretty text-[15px] leading-relaxed text-muted-foreground">
          Enam mode latihan, satu jalur adaptif. Semua hasil masuk ke progres dan klasemen kelasmu.
        </p>
      </header>

      <div className="mt-8 grid gap-px border border-rule bg-rule sm:grid-cols-2">
        {MODES.map((mode) => {
          const Icon = mode.icon

          return (
            <Link
              key={mode.href}
              href={mode.href}
              className="group flex flex-col gap-3 bg-card p-5 transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <div className="flex items-start justify-between gap-3">
                <Icon className="size-5 text-primary-deep" strokeWidth={1.7} aria-hidden="true" />
                <ArrowUpRight
                  className="size-4 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </div>
              <div>
                <p className="font-heading text-[15px] font-bold text-foreground">{mode.label}</p>
                <p className="mt-1 text-pretty text-[13px] leading-relaxed text-muted-foreground">{mode.desc}</p>
              </div>
              <p className="mt-auto font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {mode.meta}
              </p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
