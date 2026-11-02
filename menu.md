# TuturAI — Menu Overhaul & Tuning (UI-First)

> **Dokumen ini adalah satu dari tiga kaki yang saling melengkapi.**
>
> | Dokumen | Tanggung jawab |
> | --- | --- |
> | `DESIGN_OVERHAUL.md` | Aturan design system, anti-slop, token, motion, a11y, responsive |
> | **`menu.md` (ini)** | **Rencana kerja per-menu: prioritas, scope UI, scope fungsi, gate manusia** |
> | `EXECUTION.md` | Ledger eksekusi, keputusan teknis, bukti, blocker |
>
> Aturan visual tidak diulang di sini. Dokumen ini **menerapkan** `DESIGN_OVERHAUL.md`
> ke setiap menu, satu per satu, dan mengunci urutannya.

---

# 1. Operating Model

## 1.1 Human-in-the-loop adalah wajib, bukan opsional

Per pembagian peran yang disepakati:

| Peran | Siapa |
| --- | --- |
| Generate / tulis kode | **Agent** |
| Jalankan app lokal, klik, dengar, putuskan | **Manusia** |
| Gate keputusan | **Manusia** |

Agent **tidak** yang menutup stage apa pun. Setiap stage berhenti di `AWAITING_HUMAN_REVIEW`
lalu menunggu penilaian manusia: **Lanjut** atau **Revisi**.

Yang agent boleh lakukan sendiri:
- typecheck, lint, unit test, E2E otomatis
- menjalankan app lokal dan menangkap error
- memperbaiki regresi yang akibat perubahan UI

Yang **tidak** boleh dilakukan agent:
- menutup gate visual tanpa pengujian manusia
- menyatakan "sudah bagus" soal tampilan
- mengubah production
- mengarang hasil test yang tidak dijalankan

## 1.2 Ini codebase production E2E — lokal untuk review, production untuk kebenaran

Repo ini **adalah** codebase production. Tidak ada throwaway, tidak ada branch eksperimen
yang menggantung. Yang dikerjakan di localhost **tetap kode yang akan naik ke production**,
hanya dijalankan lebih dulu supaya manusia bisa menilai sebelum deploy.

```bash
# Develop + review loop (lokal)
pnpm dev                                  # turbo: semua workspace
pnpm --filter @tuturai/web dev

# Gerbang kualitas — WAJIB hijau sebelum minta review
pnpm typecheck
pnpm --filter @tuturai/web lint
pnpm --filter @tuturai/web test

# Data untuk testing manual
pnpm --filter @tuturai/web seed:demo-classroom
pnpm --filter @tuturai/web seed:question-bank
```

Setelah review lokal disetujui, kebenaran production diverifikasi dengan runner
`e2e:prod:*` yang sudah ada di root:

```bash
pnpm e2e:prod:all
```

Suite E2E production **tidak boleh** hanya mengecek layar utama. Untuk setiap menu
wajib ikut diuji: auth tidak login, role salah (siswa akses menu guru), tenant salah
(kelas guru lain), status offline, dan state kosong. Redesign yang lolos visual tapi
membuka celah otorisasi **gagal**.

## 1.2a Kualitas kode — bukan PELengkap, bagian dari deliverable

Karena ini akan naik ke production, standar kode di setiap stage sama ketatnya dengan
standar visual. Tidak ada trade-off "cuma UI, kode asal jalan".

Wajib di setiap perubahan:

- **TypeScript strict**, tidak ada `any` baru, tidak ada `@ts-ignore` tanpa alasan tertulis
- **Tidak ada duplikasi** — logika yang muncul di 2+ menu diekstrak ke shared component/helper
- **Server-side validation di setiap boundary** — validasi client bukan keamanan
- **A11y bukan pelengkap** — role, label, `focus-visible`, kontras, reduced-motion
- **Test untuk setiap logika baru** — bukan hanya screenshot
- **i18n-safe** — teks user-facing lewat konstanta, tidak di-hardcode di component
- **Nilai environment** lewat `env.ts`, tidak pernah `process.env` langsung di component
- **Tidak ada component raksasa**: satu file component maksimal ~200 baris, pecah kalau perlu
- **Konsisten**: typecheck + lint + test hijau — satu failure berarti stage belum selesai
- **reviewed diff**: baca ulang sendiri sebelum minta review, tahan diri soal
- **Tidak ada** TODO/FIXME/placeholder yang lolos ke commit

## 1.3 Urutan kerja: UI dulu, fungsi belakangan

Setiap menu processed dalam **dua lintasan terpisah** yang tidak dicampur:

```
LINTASAN A - UI      : struktur, layout, hierarchy, state kosong, responsive, motion
                      -> berhenti, minta review manusia
LINTASAN B - FUNGSI  : data, API, logika, audio, edge case
                      -> berhenti, minta review manusia
```

Aturan keras:
- **Lintas A tidak bolehmenyentuh API atau mengubah perilaku backend.**
- Lintas B **tidak boleh** mengubah visual yang sudah disetujui manusia; kalau memang perlu,
  itu perubahan visual baru dan harus minta review ulang.
- Kalau Lintas ARequires data yang belum ada, pakai **mock/fixture** yang jelas ditandai,
  bukan data palsu yang terlihat seperti data asli.

## 1.4 State tiap stage

```text
TODO
IN_PROGRESS
AWAITING_HUMAN_REVIEW      ← agent berhenti di sini
REVISE                     ← manusia minta perubahan, agent kerjakan
DONE                       ← manusia bilang Lanjut
BLOCKED                    ← butuh credential/keputusan produk
```

`AWAITING_HUMAN_REVIEW` **bukan** blocker yang bodoh. Itu memang titik handoff yangdioknot.
Pekerjaan independen di priority lain boleh lanjut; yang berhenti hanya stage tsb.

## 1.5 Prioritas diabaikan oleh dokumen ini

- Spec visual di `PRD.md` **tidak mengikat** untuk scope tampilan. Kalau bertentangan,
  `DESIGN_OVERHAUL.md` + keputusan manusia menang.
- **Domain invariant di `AGENTS.md` tetap mengikat** dan tidak boleh dilanggar oleh redesign:
  role immutable, tenant isolation, `approved` terminal, `maxAttempts` tidak bisa dilewati,
  cross-class access fail-closed.
- Tidak ada production change, tidak ada data fabrication, tidak ada placeholder yang
  masquerade sebagai fitur jadi.

---

# 2. Priority Ladder

Urutan eksekusi. Selesai satu priority baru masuk berikutnya.

| P | Judul | Menu | Status |
| --- | --- | --- | --- |
| **P0** | Landing Page | 1 | TODO |
| **P1** | Auth + App Shell | 5 | TODO |
| **P2** | Dashboard (siswa + guru) + Onboarding | 3 | TODO |
| **PX** | Pipeline Audio (prasyarat P3) | — | TODO |
| **P3** | Listening (rebuild) | 1 | TODO |
| **P4** | Voice Trio: AI Conversation, Speaking, Pronunciation | 3 | TODO |
| **P5** | Latihan Inti: Vocabulary, Quiz, Adaptive, Tes | 4 | TODO |
| **P6** | Progress & Sosial: Progress, Leaderboard, Pencapaian, Profil | 4 | TODO |
| **P7** | Teacher Operasional: Kelas, Penugasan, Siswa, Penilaian | 5 | TODO |
| **P8** | Teacher Insight: Analitik, Perangkat, Pengaturan | 3 | TODO |

Total 29 route.

---

# 3. P0 — Landing Page

**Route:** `/` (`apps/web/app/page.tsx`)

**Kenapa pertama:** ini yang pertama dilihat orang dan menentukan bahasa visual seluruh
produk. Kalau P0 jelek, semua menu berikutnya jadi terlihat murahan.

### Lintas A — UI
- [ ] Hero: headline, subheadline, CTA utama + sekunder
- [ ] Urutan section: hook → masalah → solusi → cara kerja → fitur → bukti → harga/CTA → footer
- [ ] Section fitur pakai card dengan ikon satu gaya saja, tanpa gradient dekoratif
- [ ] Copy Indonesia natural, bukan terjemahan kaku
- [ ] Mobile-first: 375px tanpa horizontal overflow
- [ ] Reduced-motion dihormati
- [ ] Meta/OG untuk share

### Lintas B — Fungsi
- [ ] Semua CTA benar-benar menuju route yang ada (tidak ada dead link)
- [ ] CTA utama → `/auth/login`, CTAsignup → `/auth/sign-up`
- [ ] Tidak ada form yang belum terhubung

### Gate manusia
> Buka `http://localhost:3000`. Ukur: apakah ini terlihat seperti produk berbayar,
> bukan template? Apakah menurutmu ini layak mengarahkan pengguna Indonesia?

---

# 4. P1 — Auth + App Shell

## P1-1 Login (`/auth/login`)
## P1-2 Sign Up (`/auth/sign-up`)
## P1-3 Sign Up Success (`/auth/sign-up-success`)
## P1-4 Auth Error (`/auth/error`)

**Kenapa P1:** shell ini membingkai 20+ menu lain. Salah di sini irreparable murah.

### Lintas A — UI
- [ ] Split layout: sisi kiri branding/nilai, sisi kanan form (desktop); stack di mobile
- [ ] Label form terlihat, bukan placeholder-as-label
- [ ] Password toggle,Caps Lock warning, show/hide yang jelas
- [ ] Error inline per-field + error global, keduanya terbaca screen reader (`role="alert"`)
- [ ] Loading state tombol (disable + spinner), tidak ada double submit
- [ ] Link Google + email/password saja (sesuai scope auth)
- [ ] Fokus ring terlihat di semua elemen interaktif

### Lintas B — Fungsi
- [ ] Google sign-in & email/password bekerja
- [ ] Role (`student`/`teacher`) ditentukan di onboarding, bukan bisa diubah klien
- [ ] Redirect setelah login sesuai role
- [ ] Rate limit & pesan error tidak membocorkan apakah email terdaftar
- [ ] `auth/error` menjelaskan penyebab dengan bahasa manusia

## P1-5 App Shell (`dashboard-shell.tsx`, `sidebar-nav.tsx`, topbar)

### Lintas A — UI
- [ ] Sidebar desktop: collapse ke icon, state tersimpan
- [ ] Mobile: drawer dengan overlay, focus trap, close saat klik luar
- [ ] Active state jelas dan tidak hanya beda warna (indikator tambahan)
- [ ] Topbar: breadcrumbs/judul halaman, notifikasi, user menu
- [ ] Scroll: sidebar tetap, konten yang scroll
- [ ] Mobile: tidak ada horizontal overflow di semua halaman

### Lintas B — Fungsi
- [ ] Nav sesuai role (siswa tidak lihat menu guru)
- [ ] Collapse state persist
- [ ] Logout bekerja dan mengembalikan ke `/auth/login`

### Gate manusia
> Login sebagai siswa. Sidebar terasa natural? Menu terlalu banyak atau pas? Di HP masih enak?

---

# 5. P2 — Dashboard & Onboarding

## P2-1 Dashboard Siswa (`/siswa`)
## P2-2 Dashboard Guru (`/guru`)
## P2-3 Onboarding (`/onboarding`)

### Lintas A — UI
- [ ] Hero greeting yang menyebut apa yang harus dilakukan **sekarang**
- [ ] Kartu progres: streak, XP, level — dengan angka asli, bukan placeholder
- [ ] "Lanjutkan belajar" → langsung ke menu yang paling relevan
- [ ] Guru: Ringkasan kelas (jumlah siswa, submission perlu review)
- [ ] Empty state yang berguna, bukan spinner atau "Belum ada data" kosong
- [ ] Skeleton hanya muncul jika memang resolve, tidak pernah mengawang

### Lintas B — Fungsi
- [ ] Semua angka dashboard berasal dari query nyata
- [ ] Tidak ada metrik palsu (halaman kosong ≠ metrik dummy)
- [ ] Onboarding: pilih role → selesai; role immutable setelahnya

### Gate manusia
> Buka dashboard. Apakah tahu harus ngapain setelah login? Ada angka yang terasa ngawur?

---

# 6. PX — Pipeline Audio (prasyarat P3)

> Bukan menu, tapi P3 **tidak bisa jalan** tanpa ini. Build agent, testimonial manusia
> (dengar langsung output suaranya).

## PX-1 Tuning steps=4 & ukur RTF asli
- [ ] Pakai Q8_0 + `Vulkan0`, `OMNIVOICE_STEPS=4`
- [ ] **Ukur RTF nyata di steps 4** — angka lama (RTF 2.5) hanya estimasi
- [ ] 5 kalimat benchmark, simpan WAV tiap setting
- [ ] Gate manusia: **dengarkan**. Kalau artifact, naikkan ke 8 (tidak perlu bangun ulang apa pun)

## PX-2 Cache disk di service OmniVoice
- [ ] Cache key: `hash(voiceId + text + steps + device)`
- [ ] Cache hit → instan; tidak panggil model
- [ ] Batas ukuran cache + cleanup

## PX-3 Integrasi Cloudinary (penyimpanan audio)
- [ ] 3 key sudah ada di `.env.local`: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- [ ] Install dependency `cloudinary`
- [ ] Upload audio Opus ~32 kbps (1 menit ≈ 240 KB)
- [ ] Public ID scheme: `tuturai/listening/{setId}`
- [ ] Signed upload dari server saja, browser tidak pegang secret
- [ ] **Free tier 25 GB — jangan tambah Firebase Storage**

## PX-4 Schema Firestore untuk listening
```text
listeningSets/{setId}
  mode: 'casual' | 'formal'
  topic, level
  scriptText                 ← sumber kebenaran
  audioPublicId, audioDurationSec
  audioStatus: none | queued | generating | ready | failed
  createdBy, classroomId?, createdAt

listeningSets/{setId}/questions/{qid}
  level: 'easy' | 'medium' | 'hard'
  prompt, options[4], correctIndex, explanation
```
- [ ] Pertanyaan dibuat dari `scriptText` yang **sama** dengan yang di-audio
- [ ] **Tidak perlu STT** — teksnya sudah diketahui
- [ ] Rules: tenant isolation, hanya creator/teacher yang boleh tulis

## PX-5 Generator 8 pertanyaan per level
- [ ] LLM (route `v1` yang sudah ada) dari `scriptText`
- [ ] Validasi: tepat 4 opsi, tepat 1 jawaban benar, opsi unik, jawaban tidak semua "A"
- [ ] 3 level per audio → 24 pertanyaan per set
- [ ] Tidak ada pertanyaan yang bocor jawaban lewat tanda baca

## PX-6 Bunuh `speechSynthesis` se menyeluruh
- [ ] Hapus `window.speechSynthesis` dari `listening` **dan** `pronunciation`
- [ ] Ganti label UI yang selama ini jujur tapi salah ("Browser speech playback")
- [ ] Kalau audio belum ready → tampilkan status jelas, **jangan** jatuh ke suara robot

### Gate manusia
> Dengarkan 5 file benchmark steps 4 vs 8. Mana yang enak dipakai?_putuskan angka final.

---

# 7. P3 — Listening (Rebuild)

**Route:** `/siswa/listening`
**Source file:** `apps/web/app/siswa/listening/page.tsx`
**Butuh:** PX-1 s.d PX-6

## Alur yang diminta

```
MENU LISTENING
  └─ 2 kartu di tengah  :  [ Santai ]  [ Baku ]
       └─ klik mode
            └─ 3 kartu  :  [ Mudah ]  [ Sedang ]  [ Sulit ]
                 └─ klik level
                      └─ topik RANDOM
                           └─ 1 menit audio
                                └─ 8 pertanyaan tentang isi audio
                                     └─ jawab → submit → skor
```

## Temuan yang harus diperbaiki

1. **Suara robot aktif.** `listening/page.tsx:88` memakai `window.speechSynthesis` —
   suara robot, sering fallback ke jaringan Google Translate. Route OmniVoice
   yang sudah terbukti **tidak pernah dipanggil** dari halaman ini.
2. **Bug mainin soal pertama.** Baris 86–108 selalu memutar `questions[0]`, apa pun soal
   yang sedang dikerjakan. Satu tombol untuk seluruh set.
3. **Model data salah.** `QuestionBankItem` itu 1 item = 1 soal. Yang diminta 1 audio + 8 soal.

### Lintas A — UI
- [ ] Layar 1: judul + subtitle, **2 kartu mode** di tengah, CARD yang bukan placeholder
- [ ] Layar 2: **3 kartu level** dengan keterangan singkat tiap level
- [ ] Layar 3: player audio (satu per set, bukan per soal), progress bar, replay
- [ ] 8 soal sebagai daftar bernomor dengan pilihan radio
- [ ] Submit → dialog hasil: benar/salah, XP, review jawaban
- [ ] State kosong: "Belum ada audio untuk mode ini" (bukan crash)
- [ ] State generating: progres "Menyiapkan audio 12/100"
- [ ] Mobile: 2 dan 3 kartu jadi stack, tidak overflow
- [ ] Kontrol audio yang bisa diakses keyboard, punya label

### Lintas B — Fungsi
- [ ] Pilih mode → pilih level → topik random dari set yang `audioStatus: ready`
- [ ] Ambil 8 soal sesuai level yang dipilih
- [ ] Audio stream dari Cloudinary, bukan regenerate on-demand
- [ ] Submit jawaban tersimpan, skor benar dari server (bukan hitung client)
- [ ] Replay tidak memanggil backend
- [ ] Kalau guru belum rekam suara → tampilkan banner, **tidak** pakai suara robot

### Gate manusia
> Pilih Santai → Mudah. Dengarkan 1 menit audio. Jawab 8 soal.
> Apakah suaranya enak? Apakah soalnya fairness? Apakah urutannya terasa benar?

---

# 8. P4 — Voice Trio

## P4-1 AI Conversation (`/siswa/percakapan`)
**Source:** `apps/web/app/siswa/percakapan/page.tsx`

**Status خاص:** route **sudah** memakai voice profile guru (`page.tsx:231` → `/api/classrooms/{id}/voice`).
Masalahnya hanya **kecepatan** dan **belum ada cache**.

### Lintas A — UI
- [ ] Chat bubbles: AI vs siswa bedanya jelas tanpa harus baca warna
- [ ] Bubble AI punya tombol "dengarkan" + indikator sedang bicara
- [ ] Skenario sebagai chip di atas, bisa diganti tanpa keluar halaman
- [ ] Task card untuk "kasih task" yangmisnan kolektif jelas
- [ ] Mic dengan state rekam/jeda/ulangi, level meter
- [ ] Indikator "menyiapkan audio" selama TTS berjalan (bukan spinner buta)

### Lintas B — Fungsi
- [ ] **Suara: clone guru** (sudah). Cache agar tidak regenerate tiap giliran
- [ ] Flow task-based: AI kasih tugas → siswa jawab → AI beri feedback bersuara guru
- [ ] Kalau latency masih >10 detik, tampilkan status, jangan diamkan

## P4-2 Speaking Practice (`/siswa/speaking`)
- [ ] Rekam → transkrip → assessment dari server
- [ ] Waveform/level meter yang menunjukkan input secara nyata
- [ ] Skor per dimensi (mengikuti `SCORING_SPEC.md`) — jangan pernah mengarang
- [ ] Kalau dimensi butuh audio tapi tidak tersedia → `insufficient_evidence` **tidak** dikarang

## P4-3 Pronunciation Lab (`/siswa/pronunciation`)
- [ ] **Ganti `speechSynthesis` dengan audio model**
- [ ] Satu kata/kalimat per giliran, fokus ke pengucapan
- [ ] Tampilkan transkrip Whisper apa adanya, termasuk ketidakpastian

### Gate manusia
> Ngobrol di AI Conversation. Apakah suaranya terasa "punya nyawa"?
> Berapa lama satu giliran bicara? Kalau lama, di mana terasa ngeganggu?

---

# 9. P5 — Latihan Inti

## P5-1 Vocabulary (`/siswa/vocabulary`)
- **UI:** kartu kata, arti, contoh kalimat, IPA; mode flip-card; progress di bawah
- **Fungsi:** kosakata dari bank soal, progres tersimpan, spaced repetition dasar

## P5-2 Quiz (`/siswa/quiz`)
- **UI:** progress bar soal, timer jika ada, navigasi sebelum submit
- **Fungsi:** skor server, review jawaban, submit sekali

## P5-3 Adaptive Path (`/siswa/adaptive`)
- **UI:** jalur belajar visualized, bukan daftar datar
- **Fungsi:** rekomendasi berdasarkan progres nyata, bukan angka dummy

## P5-4 Tes Pedagogis (`/siswa/tes`)
- **UI:**-), soal bertahap, progres jelas,jlid yang sama
- **Fungsi:** skor server,::-menyimpan hasil, tidak ada pengulangan ganda

### Gate manusia
> Untuk tiap menu: apakah jelas apa yang harus dilakukan? Apakah ada state kosong yang masuk akal?

---

# 10. P6 — Progress & Sosial

## P6-1 Progress (`/siswa/progress`)
- **UI:** grafik dari data asli, bukan ilustrasi mock; empty state jelas
- **Fungsi:** agregat dari attempt nyata

## P6-2 Leaderboard (`/siswa/leaderboard` + `/guru/leaderboard`)
- **UI:** podIUM teratas, daftar scroll, posisi sendiri di-highlight
- **Fungsi:** data nyata, refresh, tanpa nama hardcoded

## P6-3 Pencapaian (`/siswa/achievements`)
- **UI:** badge dengan state locked/unlocked, progress menuju next
- **Fungsi:** rule achievement dari event nyata

## P6-4 Profil (`/siswa/profil`)
- **UI:** avatar, identitas, preferensi, export data
- **Fungsi:** edit profil tersimpan, role **tidak bisa diubah** dari sini

### Gate manusia
> Apakah semua angka berasal dari data nyata? Ada yang terasa placeholder?

---

# 11. P7 — Teacher Operasional

## P7-1 Kelas Saya (`/guru/kelas`)
- **UI:** kartu kelas dengan join key terlihat, aksi cepat
- **Fungsi:** buat kelas, regenerate/revoke join key, daftar siswa

## P7-2 Penugasan (`/guru/penugasan`)
- **UI:** daftar assignment, status draft/published, tenggat terlihat
- **Fungsi:** buat/publish, deadline, `maxAttempts` tidak bisa dilewati

## P7-3 Siswa (`/guru/siswa` + `/guru/siswa/[studentId]`)
- **UI:** tabel siswa yang bisa dicari, detail per siswa
- **Fungsi:** hanya siswa di kelas milik guru itu; cross-class fail-closed

## P7-4 Penilaian Speaking (`/guru/penilaian`)
- **UI:** queue submission, review audio, rubrik per dimensi
- **Fungsi:** teacher hanya bisa review submission kelasnya

### Gate manusia
> Masuk sebagai guru. Apakah alur buat kelas → buat tugas →murid kerjakan → review terasa jelas?

---

# 12. P8 — Teacher Insight

## P8-1 Analitik (`/guru/analitik`)
- **UI:** grafik jelas dengan sumbu berlabel, filter berlabel
- **Fungsi:** agregat nyata, agregat sesuai kelas milik guru

## P8-2 Monitor Perangkat (`/guru/perangkat`)
- **UI:** daftar perangkat dengan status online/offline
- **Fungsi:** data MQTT nyata, **tidak** ada tombol yang eksekusi arbitrary command

## P8-3 Pengaturan (`/guru/pengaturan`)
- **UI:** form terorganisasi per seksi, simpan dengan feedback jelas
- **Fungsi:** voice profile management di sini (rekam/ganti/hapus), aturan 1 profil aktif per guru

### Gate manusia
> Apakah analitik benar-benar terbaca? Apakah pengaturan mudah dimengerti guru non-teknis?

---

# 9. TuturTalk — Peer-to-Peer Speaking Practice (P2 — Develop Terakhir)

> **Prioritas:** P2 — Develop terakhir setelah semua fitur core selesai.
> **Fitur PRD:** Fitur 11
> **Route:** `/siswa/tuturtalk`
> **Depends:** P1-5 (App Shell), Fitur 1 (Auth), Fitur 2 (Classroom), Fitur 4 (Student), Fitur 5 (AI Assessment)

## 9.1 Konsep
Omegle-style speaking practice, tapi aman dan terstruktur untuk pendidikan. Siswa dipasangkan dengan sesama siswa untuk berlatih berbicara Bahasa Inggris real-time.

## 9.2 Matching Berbasis Level (±1)
- Level sama (X ↔ X): percakapan seimbang
- Level ±1 (X ↔ X±1): sedikit tantangan
- Level ±2+: tidak diizinkan (terlalu jimplang)

## 9.3 Alur Sesi
1. Request → 2. Matching → 3. Mission Card (popup) → 4. Sesi (3-5 menit) → 5. Post-Session

## 9.4 Opsi Media
- Video+Audio, Audio Only (Open Mic), Text Chat (fallback)

## 9.5 Keamanan & Moderasi
- Identitas terverifikasi, AI moderation (Gemini), tombol lapor, auto-terminate, no direct contact

## 9.6 Gamifikasi
- +25 XP/sesi, +10 XP bonus misi, badge, leaderboard peer, streak

## 9.7 Teknologi
- WebRTC (P2P), Firebase/Redis (matching queue), STUN/TURN (NAT), Gemini (moderation)

---

# 13. Task Ledger

| ID | Priority | Menu | Status | Depends | Blocked by |
| --- | --- | --- | --- | --- | --- |
| P0-1 | P0 | Landing | TODO | — | — |
| P1-1 | P1 | Login | TODO | P0 | — |
| P1-2 | P1 | Sign Up | TODO | P1-1 | — |
| P1-3 | P1 | Sign Up Success | TODO | P1-2 | — |
| P1-4 | P1 | Auth Error | TODO | P1-1 | — |
| P1-5 | P1 | App Shell | TODO | P0 | — |
| P2-1 | P2 | Dashboard Siswa | TODO | P1-5 | — |
| P2-2 | P2 | Dashboard Guru | TODO | P1-5 | — |
| P2-3 | P2 | Onboarding | TODO | P1-2 | — |
| PX-1 | PX | Steps=4 + RTF | TODO | — | Credential gate: binary sudah ada |
| PX-2 | PX | Cache disk | TODO | PX-1 | — |
| PX-3 | PX | Cloudinary | TODO | — | Credential sudah ada di `.env.local` |
| PX-4 | PX | Schema listening | TODO | — | — |
| PX-5 | PX | Generator 8 soal | TODO | PX-4 | LLM route |
| PX-6 | PX | Bunuh speechSynthesis | TODO | — | — |
| P3-1 | P3 | Listening | TODO | PX-1..6 | — |
| P4-1 | P4 | AI Conversation | TODO | P1-5, PX-2 | — |
| P4-2 | P4 | Speaking | TODO | P1-5 | — |
| P4-3 | P4 | Pronunciation | TODO | P1-5, PX-6 | — |
| P5-1 | P5 | Vocabulary | TODO | P1-5 | — |
| P5-2 | P5 | Quiz | TODO | P1-5 | — |
| P5-3 | P5 | Adaptive | TODO | P1-5 | — |
| P5-4 | P5 | Tes Pedagogis | TODO | P1-5 | — |
| P6-1 | P6 | Progress | TODO | P1-5 | — |
| P6-2 | P6 | Leaderboard | TODO | P1-5 | — |
| P6-3 | P6 | Pencapaian | TODO | P1-5 | — |
| P6-4 | P6 | Profil | TODO | P1-5 | — |
| P7-1 | P7 | Kelas | TODO | P1-5 | — |
| P7-2 | P7 | Penugasan Guru | TODO | P7-1 | — |
| P7-3 | P7 | Siswa | TODO | P7-1 | — |
| P7-4 | P7 | Penilaian Speaking | TODO | P7-2 | — |
| P8-1 | P8 | Analitik | TODO | P7-1 | — |
| P8-2 | P8 | Perangkat | TODO | P7-1 | Hardware credential |
| P8-3 | P8 | Pengaturan | TODO | P1-5 | - |
| P9-1 | P9 | TuturTalk (Peer Practice) | TODO | P1-5 | Develop terakhir (P2) |

---

# 14. Verification Log (diisi manusia)

| Stage | Priority | Tanggal | Tester | Hasil | Catatan |
| --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | — |

---

# 15. Definition of Done per Menu

Sebuah menu `DONE` bila **semua** ini benar:

- [ ] Lintas A selesai dan manusia bilang Lanjut
- [ ] Lintas B selesai dan manusia bilang Lanjut
- [ ] `pnpm typecheck` hijau
- [ ] `pnpm --filter @tuturai/web lint` hijau
- [ ] `pnpm --filter @tuturai/web test` hijau
- [ ] Tidak ada horizontal overflow di 375px
- [ ] Keyboard bisa menjangkau semua kontrol, fokus terlihat
- [ ] State kosong, loading, dan error benar-benar ada (bukan mock)
- [ ] Tidak ada `speechSynthesis` tersisa di menu ini
- [ ] Tidak ada angka/meter dummy yang terlihat seperti data asli
- [ ] Tidak ada dead interaction (tombol yang tidak melakukan apa-apa)

---

# 16. Keputusan Terkunci (disepakati 15 Oktober 2026)

> Keputusan di bawah ini **sudah final**. Tidak dibahas ulang.

| # | Keputusan | Nilai | Alasan |
| --- | --- | --- | --- |
| **K1** | Steps OmniVoice | **4** | Sudah final. Kalau hasil dengar kurang enak, naikkan ke 8 — angka lain tidak dikunci |
| **K2** | Jumlah audio listening | **100 total** | Bukan per kombinasi. Ini mengurangi biaya generate dari 200 ke 100 |
| **K3** | Sebaran level | **30 sulit / 40 medium / 30 mudah** | Total 100 |
| **K4** | Kesulitan diukur dari **bahasa** | Audio dan soal ikut naik kesulitannya | Ini **membatalkan** rekomendasi awal bahwa level hanya mengubah soal |
| **K5** | Sebaran tipe konten | **50 conversation / 50 non-conversation** | 50/50 |
| **K6** | Durasi per audio | **1 menit** | Tetap |
| **K7** | Voice AI Conversation | **Realtime conversational TTS untuk text prompt** | Berbeda dari listening yang pre-generated, jadi punya jalur teknis sendiri |
| **K8** | Storage audio | **Cloudinary** | Free tier 25 GB. Firebase Storage ditolak karena tidak ada free tier |

## 16.1 Dampak K4 terhadap biaya

Karena level **ikut** menaikkan kompleksitas bahasa audio (K4), audio harus dibuat
**per level** - bukan satu audio dipakai untuk 3 level seperti estimasi awal.

Tapi karena K2 mengunci 100 total, biaya justru turun:

```
100 audio × 1 menit × RTF 2.5 (estimasi, langkah wajib diukur di PX-1)
Selama belum jelas, konten **tidak** dibatch - lebih baik 1 sampel dulu yang benar
```

Angka RTF 2.5 itu **estimasi**, bukan hasil ukur. PX-1 wajib mengukurnya sebelum
seluruh batch dijadwalkan.

daripada 100 yang salah matriks.

| Level | Conversation | Non-conversation | Total |
| --- | --- | --- | --- |
| Mudah | 15 | 15 | **30** |
| Medium | 20 | 20 | **40** |
| Sulit | 15 | 15 | **30** |
| **Total** | **50** | **50** | **100** |

Setiap audio punya **8 soal** pada level-nya sendiri → 800 soal total.
Semua soal dibuat dari `scriptText` yang sama persis dengan yang di-audio.

## 16.3 Yang masih perlu dipmapping (bukan diputuskan)

Peta 100 audio di atas memakai dua dimensi: **tipe** (conversation/non-conversation)
dan **level**. Sementara itu kartu mode **Santai / Baku** sudah disepakati di UI.

Belum jelas apakah "Santai / Baku" itu:
- (a) sumbu **ketiga** di samping tipe dan level, atau
- (b) sebenarnya hal yang sama dengan conversation/non-conversation, atau
- (c) memotong tiap sel 100 menjadi 25

Perlu dikonfirmasi sebelum PX-5 generator dijalankan, karena affects how 100 script ditulis.
Selama belum jelas, konten **tidak** dibatch — lebih baik 1 sampel dulu yang benar
daripada 100 yang salah matriks.

---

# 17. Urutan Kerja yang Diperbarui

Owner memutuskan **firmware dikerjakan lebih dulu**, sebelum rombak menu.
Alasannya: perlu alat untuk testing perangkat, dan P0–P2 belum butuh alat.

```text
[SEKARANG]  Firmware ESP32-S3        ← selalu jalan, blocking P0-P2? tidak
             (docs/FIRMWARE_PLAN.md)
                 │
                 ▼
[SETELAHNYA]  menu.md P0 → P2        ← UI fondasi
                 │
                 ▼
[SETELAH ITU] PX → P3 → P4           ← Butuh kartu mode/level, dan voice realtime (K7)
```

Firmware berdiri sendiri sebagai jalur kerja. P0–P2 tidak di-block olehnya karena
keduanya murni web. PX–P4 boleh berjalan paralel bila tersedia skill dan waktu.

---

# 18. Rujukan

- `DESIGN_OVERHAUL.md` — design system, anti-slop, token, motion, a11y, responsive
- `EXECUTION.md` — ledger eksekusi, keputusan teknis, bukti
- `AGENTS.md` — domain invariant (**tidak boleh dilanggar**)
- `PRD.md` — scope produk, §5B skill policy, §5C (segera) firmware scope
- `SCORING_SPEC.md` — aturan skor speaking/pronunciation
- `docs/FIRMWARE_PLAN.md` — rencana firmware ESP32-S3
