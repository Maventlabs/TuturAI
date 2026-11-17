# Laporan Audit Final — TuturAI

Tanggal: 18 November 2026
Cakupan: `apps/web` (Next.js 16 App Router), API route, aset statis, header keamanan, performa rute publik.
Basis kode: `feat/learning-level-selector` (base `main`).

## 1. Ringkasan

Tidak ditemukan isu **P0 (blocker)**. Ditemukan **1 isu High keamanan** dan **2 isu High performa**; ketiganya sudah diperbaiki di PR ini. Sisa temuan Medium/Low didokumentasikan dengan rekomendasi, bukan diperbaiki, karena menyentuh data produksi atau di luar cakupan finalisasi.

| Tingkat | Ditemukan | Diperbaiki | Terbuka |
| --- | --- | --- | --- |
| P0 Blocker | 0 | 0 | 0 |
| High | 3 | 3 | 0 |
| Medium | 3 | 1 | 2 |
| Low | 3 | 0 | 3 |
| Tidak terverifikasi (butuh kredensial/emulator) | 3 | — | 3 |

## 2. Metode

Yang benar-benar diukur pada mesin ini:

- **Build produksi** `next build` dengan environment asli (`.env.development.local`), lalu `next start -p 3100`. Semua angka performa di bawah berasal dari build produksi, bukan dev server.
- **Lab Web Vitals** via Chromium (agent-browser) pada viewport 1280×800, jaringan loopback tanpa throttling.
- **Berat transfer** dihitung dari `PerformanceResourceTiming` (`transferSize`/`encodedBodySize`) setelah `networkidle`.
- **TTFB** via `curl -w`.
- **Header keamanan, batas API, redirect, dan scan rahasia bundle** via `scripts/e2e-security-headers.mjs` yang sudah ada di repo.
- **Ukuran aset** via `sharp` metadata dan `du`.

Yang **tidak** dapat diukur dan karena itu tidak diklaim:

- Data lapangan (RUM) — proyek belum memasang kolektor Web Vitals.
- Jaringan ter-throttle (3G/4G) — sandbox tidak menyediakan network throttling.
- Alur terautentikasi (dashboard siswa/guru, listening, speaking) — tidak ada akun uji; login nyata butuh kredensial Firebase.
- Suite a11y dan sebagian e2e — `e2e-auth-accessibility.mjs` menolak berjalan tanpa Firebase Auth/Firestore emulator, dan emulator tidak tersedia di sandbox ini.

## 3. Temuan dan tindakan

### SEC-01 — High — Token LiveKit mempercayai identitas dari klien · DIPERBAIKI

`app/api/student/challenge-speaking/token/route.ts` menerima `participantName` dan `roomName` dari body request, lalu memakainya sebagai `identity` pada `AccessToken`. Siapa pun yang punya sesi siswa valid dapat membuat token yang masuk ke room mana pun dengan nama peserta mana pun (impersonasi), tanpa rate limit.

Perbaikan: `identity` selalu `auth.user.uid` dari sesi terverifikasi, `roomName` divalidasi dengan pola `^[a-z0-9][a-z0-9-]{2,63}$`, dan route diberi rate limit 20 permintaan/menit per uid memakai helper `consumeApiRateLimit` yang sudah dipakai route lain. Endpoint ini tidak dipanggil klien mana pun saat ini, jadi perubahan ini tidak mengubah perilaku UI.

### PERF-01 — High — 4,9 MB PNG mentah sebagai background CSS di landing · DIPERBAIKI

Tiga kartu perangkat memakai `background-image` CSS, sehingga melewati `next/image` dan terkirim mentah: `hardware-classroom.png` 1.693 KB, `hardware-desk.png` 1.673 KB, `hardware-chip.png` 1.527 KB. Ketiganya ikut terunduh pada muatan awal landing page.

Perbaikan: dikonversi ke WebP kualitas 82 pada lebar asli (1408 px) — 105 KB / 100 KB / 94 KB, total turun 94%. Referensi di `components/landing/offline-hardware.tsx` diperbarui. `hero-bg.png` (2.421 KB) juga dikonversi ke `hero-bg.webp` (142 KB) dan dipakai di `components/landing/hero.tsx` serta `components/auth/auth-shell.tsx`; ini penting untuk produksi karena `images.unoptimized` membuat PNG 2,4 MB terkirim apa adanya.

### PERF-02 — Medium — Preload 214 KB untuk gambar yang tidak pernah dirender · DIPERBAIKI

`app/layout.tsx` mem-preload `/brand/logo-icon.png` (218.752 byte, 512×512) dengan komentar "preload the header mark". Header sebenarnya merender `/brand/logo-mark-blue.png` (15.709 byte). Jadi setiap muatan halaman desktop mengunduh 214 KB gambar tak terpakai yang bersaing dengan aset LCP.

Perbaikan: preload diarahkan ke `logo-mark-blue.png` sesuai maksud komentar. `logo-icon.png` tetap ada karena masih dipakai pemeriksaan PWA.

### PERF-03 — Medium — Aset media statis tanpa cache · DIPERBAIKI

Tidak ada `Cache-Control` untuk `/landing`, `/brand`, `/icons`, `/learning`, `/loader-*.webp`, dan `/audio`. Klip listening berukuran ~2,5 MB per file, sehingga kunjungan ulang mengunduh ulang seluruhnya.

Perbaikan: blok `headers()` di `apps/web/next.config.mjs` — media 1 hari + `stale-while-revalidate` 7 hari, audio 7 hari. Header keamanan tetap hanya di `proxy.ts`, tidak diduplikasi.

### PERF-04 — Medium — 76 MB audio listening tidak terkompresi · TERBUKA

`public/audio/listening` berisi 30 file WAV, masing-masing ~2,5 MB (total 76 MB). Setiap soal listening mengunduh satu file penuh saat diputar. Transcode ke Opus/MP3 64 kbps akan memotong ~94% (2,5 MB → ~150 KB).

Tidak dikerjakan karena: (a) `ffmpeg` tidak tersedia di sandbox, dan (b) `audioUrl` tersimpan di Firestore oleh `scripts/seed-listening-bank.mjs`, sehingga mengganti ekstensi butuh migrasi data produksi. Ini keputusan yang perlu persetujuan, bukan perubahan senyap.

### PERF-05 — Low — Sumber PNG besar masih di `public/` · TERBUKA

`hero-bg.png`, `hardware-*.png`, `hero-student.png`, `teacher-dashboard.png` (~7,4 MB) tidak lagi dirender tetapi masih ikut ter-deploy. Sengaja dipertahankan sebagai sumber re-encode; bisa dipindah ke `assets/` di luar `public/` pada PR terpisah.

### PERF-06 — Low — N+1 pada `/api/student/dashboard` · TERBUKA

`buildDashboardResponse` memanggil `getStudentSubmission(assignment.id, uid)` per assignment. Untuk kelas dengan banyak tugas ini menjadi N pembacaan Firestore. Dampaknya diredam `cacheAside`, jadi tidak diubah pada finalisasi ini; rekomendasi: satu query `where('studentId','==',uid).where('assignmentId','in',[...])`.

### PERF-07 — Low — Main thread landing page berat · TERBUKA (observasi)

Saat verifikasi, `Runtime.evaluate` dan `Page.captureScreenshot` berulang kali timeout pada landing page dan pada section `#offline` (scene three.js), sementara halaman lain (`/auth/login`) merespons normal. Ini konsisten dengan scene 3D yang berjalan di software renderer sandbox, bukan bukti regresi, tetapi menandakan section 3D adalah beban main thread terbesar di halaman itu. Scene sudah di-gate `IntersectionObserver` + `dynamic(ssr:false)`, jadi tidak ada perubahan tambahan.

### Tidak terverifikasi

- **AUTH-01** — login email/password dan Google nyata tidak diuji: tidak ada akun uji, dan `WEB-AUTH-002` sudah tercatat `BLOCKED_EXTERNAL` di `EXECUTION.md`.
- **A11Y-01** — `e2e:auth-accessibility` butuh Firebase Auth + Firestore emulator; tidak tersedia.
- **E2E-01** — suite e2e terautentikasi (assignment, classroom, speaking) tidak dijalankan karena alasan yang sama.

## 4. Hasil sebelum/sesudah

Build produksi, `next start`, Chromium 1280×800, loopback tanpa throttling.

| Rute | Metrik | Sebelum | Sesudah | Δ |
| --- | --- | --- | --- | --- |
| `/` | Total transfer | 6.208 KB | 1.742 KB | **−72%** (−4,47 MB) |
| `/` | LCP | 296 ms | 200 ms | −96 ms |
| `/` | FCP | 296 ms | 200 ms | −96 ms |
| `/` | CLS | 0,00 | 0,00 | 0 |
| `/` | TTFB | 93,3 ms | 6,4 ms | server sudah panas |
| `/auth/login` | Total transfer | 1.157 KB | 955 KB | **−17,5%** (−202 KB) |
| `/api/me` (401) | TTFB | — | 4,7 ms | — |

Catatan kejujuran: LCP/FCP di loopback tidak sensitif terhadap berat payload karena tidak ada latensi jaringan, jadi penurunan 96 ms bukan proyeksi produksi. Angka yang bisa diproyeksikan adalah **pengurangan transfer 4,47 MB pada landing page** dan **202 KB pada halaman login** — keduanya diukur langsung dari resource timing browser.

## 5. Pemeriksaan yang dijalankan

| Pemeriksaan | Perintah | Hasil |
| --- | --- | --- |
| Typecheck | `pnpm typecheck` | PASS |
| Unit/integration test | `pnpm test` | 435 lulus, 2 dilewati (emulator), 79 file |
| Lint | `pnpm lint` | 0 error, 10 warning (semuanya sudah ada sebelumnya) |
| Build produksi | `pnpm build` | PASS |
| Header keamanan + batas API + redirect + scan rahasia bundle | `SECURITY_BASE_URL=http://localhost:3100 node scripts/e2e-security-headers.mjs` | PASS (semua; HSTS di-skip karena `next start` bukan edge Netlify) |
| Cache-Control media | `curl -I` | Terpasang sesuai konfigurasi |
| Scan rahasia manual di `.next/static` | `grep` kunci privat/API | Bersih |

## 6. Rekomendasi prioritas berikutnya

1. **Transcode audio listening** ke Opus/MP3 + migrasi `audioUrl` di Firestore (butuh persetujuan; potensi −72 MB).
2. **Batch query submission** di `/api/student/dashboard`.
3. **Pasang kolektor Web Vitals** (field data) supaya audit berikutnya tidak bergantung pada lab loopback.
4. **Jalankan suite emulator** (a11y, auth, classroom) di CI agar temuan "tidak terverifikasi" di atas menjadi bukti nyata.
5. **Pindahkan sumber PNG** ke luar `public/` untuk memangkas 7,4 MB dari artefak deploy.
