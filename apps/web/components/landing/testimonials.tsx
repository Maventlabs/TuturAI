import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { InfiniteSlider } from '@/components/ui/infinite-slider'
import { cn } from '@/lib/utils'
import { GSAPLines, GSAPReveal } from './gsap-helpers'

type Testimonial = {
  quote: string
  name: string
  role: string
  initials: string
}

const testimonials: Testimonial[] = [
  {
    quote:
      'Dulu aku nggak berani ngomong bahasa Inggris di depan kelas. Setelah dua bulan latihan rutin di TuturAI, presentasiku akhirnya lancar dan aku berhenti overthinking sebelum bicara.',
    name: 'Rani Puspita',
    role: 'Siswa SMA, kelas XI',
    initials: 'RP',
  },
  {
    quote:
      'Feedback lima dimensinya bikin aku tahu persis mana yang lemah. Bukan cuma "bagus" atau "kurang", tapi grammar dan vocabulary-ku dinilai terpisah.',
    name: 'Bima Ardiansyah',
    role: 'Siswa SMK, kelas XII',
    initials: 'BA',
  },
  {
    quote:
      'Streak dan XP bikin latihan jadi kebiasaan. Sekarang aku latihan speaking tiap hari sebelum tidur, kayak scrolling tapi versi bermanfaat.',
    name: 'Salsabila Rahma',
    role: 'Siswa SMA, kelas X',
    initials: 'SR',
  },
  {
    quote:
      'Dashboard analitiknya menunjukkan kesalahan yang paling sering muncul di kelasku, jadi aku tahu materi mana yang harus diulang minggu depan.',
    name: 'Hendra Wijaya',
    role: 'Guru Bahasa Inggris, SMA',
    initials: 'HW',
  },
  {
    quote:
      'Perangkat offline-nya menyelamatkan kelas kami yang sinyalnya terbatas. Siswa tetap latihan speaking setiap hari tanpa kuota.',
    name: 'Ratna Kusuma',
    role: 'Guru SMK',
    initials: 'RK',
  },
  {
    quote:
      'Suara latihannya pakai suara guru sendiri lewat voice profile. Rasanya kayak les privat, bukan ngomong sama robot yang kaku.',
    name: 'Dewi Anggraini',
    role: 'Siswa SMA, kelas XI',
    initials: 'DA',
  },
  {
    quote:
      'Yang aku suka, penilaiannya jujur. Kalau bukti audionya belum cukup, pronunciation ditandai belum bisa dinilai — bukan dikira-kira asal ada angka.',
    name: 'Andi Prasetyo',
    role: 'Guru Bahasa Inggris, SMK',
    initials: 'AP',
  },
  {
    quote:
      'Leaderboard kelas bikin semangat. Teman-teman sekarang saling tantang streak harian, dan yang paling takut bicara jadi paling rajin latihan.',
    name: 'Farhan Maulana',
    role: 'Siswa SMA, kelas XII',
    initials: 'FM',
  },
  {
    quote:
      'Laporan PDF-nya memudahkan aku menjelaskan perkembangan tiap siswa saat rapat komite. Data yang biasanya susah dikumpulkan jadi otomatis.',
    name: 'Maya Lestari',
    role: 'Wali Kelas, SMA',
    initials: 'ML',
  },
]

const firstColumn = testimonials.slice(0, 3)
const secondColumn = testimonials.slice(3, 6)
const thirdColumn = testimonials.slice(6, 9)

export function Testimonials() {
  return (
    <section id="testimoni" data-nav-theme="light" className="scroll-mt-24 bg-background px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="mx-auto max-w-3xl text-center">
          <GSAPReveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground">
            Testimoni
          </p>
        </GSAPReveal>

        <GSAPLines>
          <h2 className="mt-4 font-display text-3xl font-medium leading-[1.1] tracking-[-0.015em] text-foreground text-balance sm:text-4xl lg:text-5xl">
            <span data-line className="block">
              Kata Mereka yang
            </span>
            <span data-line className="block">
              Sudah <span className="text-primary">Latihan</span>
            </span>
          </h2>
        </GSAPLines>

          <GSAPReveal delay={0.1}>
            <p className="mt-5 text-foreground text-pretty">
              <strong className="font-semibold text-foreground">Catatan jujur</strong> dari siswa
              dan guru yang memakainya setiap hari.
            </p>
          </GSAPReveal>
        </div>

        <div
          className="mx-auto mt-12 flex max-h-[36rem] justify-center gap-4 sm:gap-6"
          style={{
            maskImage:
              'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
          }}
        >
          <InfiniteSlider speed={48} className="w-full max-w-xs">
            {firstColumn.map((testimonial) => (
              <TestimonialCard key={testimonial.name} testimonial={testimonial} />
            ))}
          </InfiniteSlider>

          <InfiniteSlider speed={64} className="hidden w-full max-w-xs md:block">
            {secondColumn.map((testimonial) => (
              <TestimonialCard key={testimonial.name} testimonial={testimonial} />
            ))}
          </InfiniteSlider>

          <InfiniteSlider speed={54} className="hidden w-full max-w-xs lg:block">
            {thirdColumn.map((testimonial) => (
              <TestimonialCard key={testimonial.name} testimonial={testimonial} />
            ))}
          </InfiniteSlider>
        </div>
      </div>
    </section>
  )
}

function TestimonialCard({
  testimonial,
  className,
}: {
  testimonial: Testimonial
  className?: string
}) {
  const { quote, name, role, initials } = testimonial

  return (
    <figure
      className={cn(
        'mb-6 rounded-xl border border-border bg-card p-6 shadow-[0_16px_40px_-28px_rgba(29,29,31,0.25)]',
        className,
      )}
    >
      <blockquote className="text-sm leading-relaxed text-foreground text-pretty">
        &ldquo;{quote}&rdquo;
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3">
        <Avatar className="h-9 w-9 rounded-full border border-border">
          <AvatarFallback className="bg-secondary font-heading text-xs font-bold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <cite className="text-sm font-semibold not-italic leading-5 tracking-tight text-foreground">
            {name}
          </cite>
          <span className="text-sm leading-5 tracking-tight text-muted-foreground">{role}</span>
        </div>
      </figcaption>
    </figure>
  )
}
