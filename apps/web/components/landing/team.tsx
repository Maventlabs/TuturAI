import { TeamLanyardRail, type LanyardMember } from '@/components/ui/team-lanyard-rail'
import { GSAPLines, GSAPReveal } from './gsap-helpers'

const teamPortraitSheet =
  'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-RnjcwLU3k6Ry9PG9xtGGISL5eBFeyJ.png'

const members: LanyardMember[] = [
  {
    id: 'muhammad-yusuf-aditiya',
    name: 'Muhammad Yusuf Aditiya',
    role: 'Ketua Tim & Lead AI Engineer',
    image: teamPortraitSheet,
    imageCrop: { size: '444% 249%', position: '16% 28%' },
    bio: 'Mengawal arah produk dan memimpin pengembangan AI untuk latihan speaking yang aman dan adaptif.',
    tags: ['AI', 'Core team'],
    tone: 1,
  },
  {
    id: 'nazuwatussyadiyah',
    name: "Nazuwatussya'diyah, S.T., M.T.",
    role: 'Dosen Pembimbing',
    image: teamPortraitSheet,
    imageCrop: { size: '444% 249%', position: '49% 30%' },
    bio: 'Menjaga riset dan keputusan pembelajaran TuturAI tetap berpijak pada tujuan pendidikan.',
    tags: ['Education', 'Research'],
    tone: 1,
  },
  {
    id: 'rahadian-maulana-irfandi',
    name: 'Rahadian Maulana Irfandi',
    role: 'Project Manager',
    image: teamPortraitSheet,
    imageCrop: { size: '444% 249%', position: '82% 28%' },
    bio: 'Menyelaraskan prioritas dan kolaborasi agar setiap bagian TuturAI bergerak ke tujuan yang sama.',
    tags: ['Product', 'Delivery'],
    tone: 1,
  },
  {
    id: 'rafi-rafsanjani',
    name: 'Rafi Rafsanjani',
    role: 'IoT Engineer',
    image: teamPortraitSheet,
    imageCrop: { size: '444% 249%', position: '32% 82%' },
    bio: 'Mengembangkan perangkat yang membawa latihan speaking ke situasi belajar dengan konektivitas terbatas.',
    tags: ['IoT', 'Offline-first'],
    tone: 1,
  },
  {
    id: 'dimas-rifai',
    name: "Dimas Rifa'i",
    role: '3D Product Designer',
    image: teamPortraitSheet,
    imageCrop: { size: '444% 249%', position: '69% 81%' },
    bio: 'Merancang bentuk 3D perangkat TuturAI agar teknologi terasa lebih dekat dengan ruang belajar.',
    tags: ['3D Design', 'Hardware'],
    tone: 1,
  },
]

export function Team() {
  return (
    <section
      id="tim"
      data-nav-theme="light"
      className="section-y scroll-mt-24 bg-secondary px-4 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-[1400px]">
        <header className="mx-auto max-w-3xl text-center">
          <GSAPReveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Tim</p>
          </GSAPReveal>

          <GSAPLines>
            <h2 className="mt-4 font-display text-3xl font-medium leading-[1.1] tracking-[-0.015em] text-foreground text-balance sm:text-4xl lg:text-5xl">
              <span data-line className="block">
                Orang di balik
              </span>
              <span data-line className="block text-primary">
                setiap latihan.
              </span>
            </h2>
          </GSAPLines>

          <GSAPReveal delay={0.1}>
            <p className="mx-auto mt-6 max-w-[58ch] text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
              Lima orang yang menyusun riset, produk, perangkat, dan desain TuturAI, supaya latihan
              bicara terasa lebih aman dan dekat dengan setiap siswa.
            </p>
          </GSAPReveal>
        </header>

        <TeamLanyardRail
          items={members}
          label="Tim TuturAI"
          hint="Pilih kartu untuk melihat profil. Klik atau tekan Enter untuk membuka, Esc untuk kembali."
          labels={{
            flip: 'Klik atau tekan Enter untuk membuka profil',
            back: 'Klik lagi atau tekan Esc untuk kembali',
            show: 'Pilih anggota tim',
          }}
          className="mt-10 sm:mt-14"
        />
      </div>
    </section>
  )
}
