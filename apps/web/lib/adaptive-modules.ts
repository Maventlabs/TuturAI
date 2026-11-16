export const adaptiveCategories = [
  { id: 'speaking', label: 'Speaking', focus: 'menyampaikan ide lisan dengan jelas dan percaya diri' },
  { id: 'reading', label: 'Reading', focus: 'memahami gagasan utama, detail, dan kosakata dari teks' },
  { id: 'listening', label: 'Listening', focus: 'menangkap informasi utama dan detail dari ujaran' },
  { id: 'quiz', label: 'Grammar & Vocabulary', focus: 'menggunakan tata bahasa dan kosakata secara tepat' },
] as const

export const adaptiveLevels = [
  { id: 'support', label: 'Perlu Bimbingan', range: '0–39', descriptor: 'Mulai dari fondasi dan latihan terpandu.' },
  { id: 'emerging', label: 'Mulai Berkembang', range: '40–59', descriptor: 'Bangun konsistensi melalui latihan bertahap.' },
  { id: 'capable', label: 'Cakap', range: '60–79', descriptor: 'Perkuat penerapan pada konteks yang beragam.' },
  { id: 'proficient', label: 'Mahir', range: '80–100', descriptor: 'Tantang kemampuan dengan tugas lebih mandiri.' },
] as const

export function getAdaptiveLevelForScore(score: number | null): AdaptiveLevelId | null {
  if (score === null || !Number.isFinite(score)) return null
  if (score < 40) return 'support'
  if (score < 60) return 'emerging'
  if (score < 80) return 'capable'
  return 'proficient'
}

export type AdaptiveCategoryId = (typeof adaptiveCategories)[number]['id']
export type AdaptiveLevelId = (typeof adaptiveLevels)[number]['id']
export type AdaptiveModule = {
  id: string
  categoryId: AdaptiveCategoryId
  category: string
  levelId: AdaptiveLevelId
  level: string
  range: string
  title: string
  banner: string
  summary: string
  analysis: string
  objectives: string[]
  recommendations: string[]
  activities: { title: string; instruction: string; evidence: string }[]
  nextStep: string
}

const categoryContent: Record<AdaptiveCategoryId, { skill: string; banner: string; tasks: [string, string, string][] }> = {
  speaking: {
    skill: 'berbicara', banner: 'SPEAKING / LATIHAN TERARAH',
    tasks: [
      ['Kalimat inti', 'Ucapkan tiga kalimat sederhana tentang rutinitasmu. Beri jeda pendek setelah setiap ide.', 'Rekaman atau catatan latihan: pesan utama dapat dikenali.'],
      ['Cerita berpandu', 'Jelaskan pengalaman singkat dengan urutan awal, kejadian, dan penutup menggunakan kata penghubung.', 'Sampel ujaran menunjukkan urutan ide dan penggunaan penghubung.'],
      ['Opini dan alasan', 'Sampaikan pendapat tentang topik dekat dengan kehidupan siswa, lalu dukung dengan dua alasan.', 'Sampel ujaran memuat opini, alasan, dan contoh yang relevan.'],
      ['Presentasi spontan', 'Pilih topik baru, susun poin utama secara mandiri, lalu sampaikan presentasi singkat dan tanggapi satu pertanyaan.', 'Sampel ujaran menunjukkan organisasi mandiri dan respons yang relevan.'],
    ],
  },
  reading: {
    skill: 'membaca', banner: 'READING / PEMAHAMAN TEKS',
    tasks: [
      ['Kata kunci', 'Baca paragraf pendek. Tandai kata yang dikenal dan cocokkan makna kata baru dari konteks kalimat.', 'Catatan kata kunci beserta petunjuk konteks yang digunakan.'],
      ['Gagasan utama', 'Baca teks dua paragraf dan tulis satu kalimat yang merangkum gagasan utama tiap paragraf.', 'Ringkasan singkat sesuai isi teks.'],
      ['Bukti dan inferensi', 'Temukan dua detail pendukung dan simpulkan maksud penulis dengan merujuk bukti teks.', 'Jawaban memuat inferensi dan lokasi bukti yang mendukung.'],
      ['Analisis lintas teks', 'Bandingkan dua teks bertopik serupa, nilai tujuan penulis, lalu rangkum persamaan dan perbedaannya.', 'Perbandingan menyebut tujuan dan bukti dari kedua teks.'],
    ],
  },
  listening: {
    skill: 'menyimak', banner: 'LISTENING / MENANGKAP MAKNA',
    tasks: [
      ['Tangkap inti', 'Dengarkan satu ujaran pendek dua kali. Pilih siapa, topik, dan tujuan percakapan.', 'Jawaban menangkap konteks umum tanpa menebak detail.'],
      ['Catat detail', 'Dengarkan pengumuman singkat dan catat nama, waktu, tempat, serta satu instruksi penting.', 'Catatan memuat detail yang benar-benar terdengar.'],
      ['Urutan dan maksud', 'Dengarkan dialog, susun urutan kejadian, lalu jelaskan maksud pembicara menggunakan petunjuk ujaran.', 'Urutan sesuai percakapan dan maksud didukung petunjuk.'],
      ['Sudut pandang', 'Bandingkan dua pendapat lisan tentang isu yang sama dan simpulkan perbedaan alasan serta sikap pembicara.', 'Ringkasan membedakan klaim, alasan, dan sikap kedua pembicara.'],
    ],
  },
  quiz: {
    skill: 'grammar dan kosakata', banner: 'LANGUAGE / GRAMMAR & VOCABULARY',
    tasks: [
      ['Pola kalimat dasar', 'Lengkapi kalimat sederhana dengan bentuk kata kerja yang sesuai, lalu baca kalimat lengkap untuk memeriksa makna.', 'Jawaban menunjukkan subjek, kata kerja, dan makna yang selaras.'],
      ['Pilihan kata', 'Pilih kata yang paling tepat dari konteks kalimat dan buat satu kalimat baru menggunakan kata tersebut.', 'Pilihan kata sesuai konteks dan digunakan kembali secara tepat.'],
      ['Perbaiki dan kembangkan', 'Perbaiki kesalahan tata bahasa pada paragraf pendek, kemudian variasikan kosakata tanpa mengubah maksud.', 'Versi revisi lebih tepat dan mempertahankan pesan awal.'],
      ['Gunakan secara mandiri', 'Tulis respons singkat untuk situasi autentik dengan variasi struktur kalimat dan kosakata yang sesuai audiens.', 'Teks menunjukkan pilihan bahasa yang tepat untuk tujuan dan audiens.'],
    ],
  },
}

const levelGuidance: Record<AdaptiveLevelId, { analysis: string; objectives: string[]; recommendations: string[]; nextStep: string }> = {
  support: {
    analysis: 'Profil ini mengindikasikan fondasi pada area ini masih perlu dibangun dengan contoh konkret, instruksi singkat, dan kesempatan mencoba ulang. Gunakan hasil sebagai panduan belajar, bukan label kemampuan tetap.',
    objectives: ['Memahami satu target kecil dalam satu waktu.', 'Mencoba strategi dengan contoh atau kerangka yang disediakan.', 'Mengenali bagian yang sudah berhasil sebelum memperbaiki bagian berikutnya.'],
    recommendations: ['Belajar dalam sesi singkat dan ulangi contoh dengan suara atau catatan sendiri.', 'Minta bantuan guru saat instruksi atau kosakata belum jelas.', 'Ulangi pemeriksaan setelah latihan berikutnya; jangan menyimpulkan kemajuan dari satu aktivitas.'],
    nextStep: 'Ulangi latihan fondasi dan tinjau kembali setelah ada beberapa bukti belajar baru.',
  },
  emerging: {
    analysis: 'Profil ini menunjukkan sebagian strategi mulai digunakan, tetapi penerapannya belum konsisten. Latihan bertahap membantu menghubungkan pemahaman dengan praktik mandiri.',
    objectives: ['Menggunakan strategi dasar dengan lebih konsisten.', 'Menambah satu detail atau alasan pada setiap respons.', 'Memeriksa hasil dengan daftar cek sederhana.'],
    recommendations: ['Gunakan kerangka latihan, lalu kurangi bantuan secara bertahap.', 'Catat satu keberhasilan dan satu hal yang ingin diperbaiki.', 'Latih materi yang sama pada dua konteks berbeda.'],
    nextStep: 'Lanjutkan latihan bertahap dan kumpulkan bukti pada konteks yang berbeda.',
  },
  capable: {
    analysis: 'Profil ini mengindikasikan target dasar telah diterapkan pada sebagian besar latihan. Fokus berikutnya adalah ketepatan, keluwesan, dan penerapan pada situasi yang lebih bervariasi.',
    objectives: ['Menerapkan strategi pada konteks baru.', 'Mendukung jawaban dengan detail atau bukti relevan.', 'Meninjau ulang ketepatan tanpa kehilangan kelancaran.'],
    recommendations: ['Pilih topik yang belum pernah dilatih dan terapkan strategi yang sama.', 'Bandingkan dua hasil latihan untuk menemukan pola yang perlu diperbaiki.', 'Minta umpan balik spesifik pada satu aspek, bukan penilaian umum.'],
    nextStep: 'Coba tugas transfer pada konteks baru, lalu tinjau bukti hasilnya.',
  },
  proficient: {
    analysis: 'Profil ini menunjukkan penerapan yang kuat pada data yang tersedia. Perluasan tantangan dapat menjaga perkembangan, sambil tetap memeriksa kualitas dan keterpahaman hasil.',
    objectives: ['Menyelesaikan tugas terbuka secara mandiri.', 'Menyesuaikan strategi terhadap tujuan dan audiens.', 'Memberi alasan atau refleksi berbasis bukti.'],
    recommendations: ['Pilih tantangan autentik dengan lebih dari satu kemungkinan jawaban.', 'Lakukan refleksi singkat terhadap strategi yang paling efektif.', 'Jelaskan strategi kepada teman sebagai latihan metakognitif.'],
    nextStep: 'Pilih tantangan terbuka berikutnya dan gunakan refleksi untuk menetapkan sasaran baru.',
  },
}

export const adaptiveModules: AdaptiveModule[] = adaptiveCategories.flatMap((category) =>
  adaptiveLevels.map((level, index) => {
    const content = categoryContent[category.id]
    const guidance = levelGuidance[level.id]
    const [activityTitle, instruction, evidence] = content.tasks[index]
    return {
      id: `${category.id}-${level.id}`,
      categoryId: category.id,
      category: category.label,
      levelId: level.id,
      level: level.label,
      range: level.range,
      title: `${category.label}: ${activityTitle}`,
      banner: content.banner,
      summary: `Modul ${level.label.toLowerCase()} untuk ${content.skill}: ${category.focus}.`,
      analysis: guidance.analysis,
      objectives: guidance.objectives,
      recommendations: guidance.recommendations,
      activities: [
        { title: 'Pemanasan', instruction: `Siapkan diri untuk ${content.skill}. ${level.descriptor}`, evidence: 'Siswa memahami tujuan dan siap mencoba aktivitas.' },
        { title: activityTitle, instruction, evidence },
        { title: 'Refleksi', instruction: 'Tulis atau sampaikan satu hal yang berhasil dan satu langkah yang akan dicoba berikutnya.', evidence: 'Refleksi singkat menjadi dasar tindak lanjut belajar.' },
      ],
      nextStep: guidance.nextStep,
    }
  }),
)

export function getAdaptiveModule(moduleId: string) {
  return adaptiveModules.find((module) => module.id === moduleId) ?? null
}
