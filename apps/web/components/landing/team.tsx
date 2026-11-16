import TeamLanyardRail, { type LanyardMember } from '@/components/ui/team-lanyard-rail'

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
    tone: 3,
  },
  {
    id: 'nazuwatussyadiyah',
    name: "Nazuwatussya'diyah, S.T., M.T.",
    role: 'Dosen Pembimbing',
    image: teamPortraitSheet,
    imageCrop: { size: '444% 249%', position: '49% 30%' },
    bio: 'Menjaga riset dan keputusan pembelajaran TuturAI tetap berpijak pada tujuan pendidikan.',
    tags: ['Education', 'Research'],
    tone: 3,
  },
  {
    id: 'rahadian-maulana-irfandi',
    name: 'Rahadian Maulana Irfandi',
    role: 'Project Manager',
    image: teamPortraitSheet,
    imageCrop: { size: '444% 249%', position: '82% 28%' },
    bio: 'Menyelaraskan prioritas dan kolaborasi agar setiap bagian TuturAI bergerak ke tujuan yang sama.',
    tags: ['Product', 'Delivery'],
    tone: 3,
  },
  {
    id: 'rafi-rafsanjani',
    name: 'Rafi Rafsanjani',
    role: 'IoT Engineer',
    image: teamPortraitSheet,
    imageCrop: { size: '444% 249%', position: '32% 82%' },
    bio: 'Mengembangkan perangkat yang membawa latihan speaking ke situasi belajar dengan konektivitas terbatas.',
    tags: ['IoT', 'Offline-first'],
    tone: 3,
  },
  {
    id: 'dimas-rifai',
    name: "Dimas Rifa'i",
    role: '3D Product Designer',
    image: teamPortraitSheet,
    imageCrop: { size: '444% 249%', position: '69% 81%' },
    bio: 'Merancang bentuk 3D perangkat TuturAI agar teknologi terasa lebih dekat dengan ruang belajar.',
    tags: ['3D Design', 'Hardware'],
    tone: 3,
  },
]

export function Team() {
  return (
    <TeamLanyardRail
      id="tim"
      data-nav-theme="dark"
      items={members}
      eyebrow="THE PEOPLE BEHIND THE PRACTICE · 05 PROFILES"
      heading="Meet the Team — People Behind TuturAI"
      caption="Satu tim, satu tujuan: membuat latihan bicara terasa lebih aman dan dekat dengan setiap siswa. Pilih kartu, lalu klik atau tekan Enter untuk membuka profil; tekan Esc untuk kembali."
      labels={{
        flip: 'Klik atau tekan Enter untuk membuka profil',
        back: 'Klik lagi atau tekan Esc untuk kembali',
        show: 'Pilih anggota tim',
      }}
      className="team-lanyard-rail scroll-mt-20"
    />
  )
}
