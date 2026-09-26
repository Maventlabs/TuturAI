# AGENTS.md — TuturAI

Dokumen ini adalah companion file untuk `PRD.md`. Agent coding harus membaca keduanya sebelum mengubah proyek.

## 1. Operating Contract

1. Kerjakan phase pada `PRD.md` secara berurutan dan implementasikan perilaku yang benar-benar bekerja end-to-end.
2. Setelah acceptance criteria dan verification phase saat ini lulus, lanjutkan otomatis ke phase berikutnya.
3. Jangan pause hanya untuk meminta preferensi opsional. Pause hanya bila membutuhkan:
   - credential/API key/OAuth secret yang belum tersedia,
   - tindakan destructive/irreversible,
   - pembayaran nyata,
   - perubahan production,
   - keputusan produk yang belum dapat diturunkan dari PRD.
4. Jangan menghapus task yang belum selesai. Tandai progres dengan checkbox dan catatan blocker.
5. Jangan mengklaim sukses bila external provider, upload, AI inference, OAuth, device, atau database belum benar-benar mengonfirmasi hasil.

## 2. Skill & Tool Discovery

Sebelum implementasi phase baru:
- Periksa skill yang tersedia pada environment.
- Gunakan skill yang **terinstal dan relevan**; sebutkan skill yang dipakai.
- Rekomendasi kategori skill: React/TypeScript, PWA/offline-first, Firebase/Firestore, web security, API integration, testing/E2E, accessibility, PDF/reporting, ESP-IDF/FreeRTOS/embedded IoT.
- Skill ≠ MCP/connector ≠ credential. Skill adalah instruksi/workflow. MCP/connector adalah capability eksternal. Credential adalah secret/authorization.
- Jangan menganggap Google Drive, GitHub, Firebase, AI tunnel, atau deployment terhubung hanya karena ada skill terkait.
- Jika connector/MCP tersedia tetapi belum authorized, lakukan harmless read/connection check bila didukung; bila authorization diperlukan, berhenti pada credential gate.

## 3. Product Source of Truth

Urutan prioritas:
1. `PRD.md` terbaru.
2. Keputusan user terbaru yang eksplisit.
3. Current working code/repository.
4. Proposal LIDM sebagai baseline pedagogi/produk.

Nama model lama di proposal seperti Qwen/Wav2Vec2/Gemma self-hosted **bukan constraint implementasi**. Behavior yang dipertahankan adalah speaking assessment multidimensi, adaptive learning, offline-first, teacher analytics, dan hardware roadmap.

Current AI design:
- STT: Whisper Large V3 melalui configured provider/API.
- Voice clone: OmniVoice.
- TTS: self-hosted.
- LLM: provider/model configurable; Gemma hanya default sementara bila dikonfigurasi.
- Base URL/tunnel, API key, dan model ID wajib melalui environment/config server-side.

## 4. Architecture Boundaries

### Frontend
- PWA berjalan di Netlify.
- Jangan expose server secrets ke browser.
- Durable domain data berasal dari server/Firestore; IndexedDB hanya untuk cache, draft, queue, dan offline recovery.
- UI harus menampilkan loading/error/offline/sync state yang nyata.

### Backend
- Sensitive operations melalui Netlify Functions/secure server layer: Drive OAuth/upload, AI proxy, privileged Firestore mutations, reports, device pairing/commands.
- Verifikasi Firebase ID Token pada setiap protected endpoint.
- Gunakan shared validation schema dan shared error envelope.

### Firebase
- Auth production menggunakan Google + email/password. GitHub dan provider sosial lain di luar scope; UI login/registrasi menyediakan Google dan email/password.
- `role` permanent setelah onboarding; client tidak boleh mengubahnya.
- Gunakan Firestore Security Rules dan test rules di emulator.
- Jangan menambahkan Firebase Storage kecuali PRD diubah secara eksplisit.

### Google Drive
- Drive OAuth adalah koneksi integrasi guru yang terpisah dari login TuturAI; bukan metode sign-in aplikasi.
- Prefer least-privilege scope `drive.file`.
- Assignment/submission file berada di Drive guru; Firestore menyimpan metadata.
- OAuth refresh token, bila diperlukan, disimpan encrypted dan server-only.
- Student tidak perlu connect Drive untuk submit melalui TuturAI.

### AI
- Semua provider di belakang adapter internal.
- Tidak boleh hardcode hostname tunnel/model ID.
- Tangani timeout, retry terbatas, provider error, invalid JSON, partial output, dan cancellation.
- Never fabricate score. Jika inference gagal, status harus `failed/retryable`, bukan `completed`.
- Normalized assessment contract minimal: pronunciation, fluency, intonation, grammar, vocabulary, overall, transcript, feedback, confidence/error metadata.

### Voice
- Tepat satu active voice profile per teacher.
- Voice profile harus tenant/teacher isolated.
- Enrollment harus consentful dan memiliki delete/re-enroll path.
- Jangan gunakan voice sample untuk tujuan lain.

### Offline
- Gunakan IndexedDB untuk draft/audio queue/cache; Cache Storage untuk app shell/assets.
- Setiap mutation yang di-queue harus memiliki idempotency key.
- Reconnect tidak boleh menghasilkan duplicate submission/session.
- Jangan tandai synced sebelum server mengonfirmasi.
- Implement quota monitoring/cleanup untuk temporary audio.

### Hardware
- Hardware tetap satu produk TuturAI.
- Firmware: ESP-IDF + FreeRTOS.
- MQTT over TLS untuk presence, telemetry, config/command ringan.
- HTTPS untuk audio/file/artifact besar.
- Per-device credential dan topic ACL wajib.
- Device harus tetap aman ketika cloud unavailable; jangan mengeksekusi arbitrary command dari dashboard.

## 5. UI/UX Rules

Gunakan preset `precision-blue` dari PRD:
- canvas `#f5f5f7`
- surface `#ffffff`
- text `#1d1d1f`
- mutedText `#6e6e73`
- primary `#2f6df5`
- primaryText `#ffffff`
- border `#d2d2d7`
- accent `#0071e3`
- Inter / Inter / IBM Plex Mono

MUST NOT:
- decorative gradient tanpa fungsi,
- emoji sebagai icon UI,
- icon campur style,
- shadow generik sama pada semua card,
- animation otomatis pada semua elemen,
- fake skeleton yang tidak pernah resolve,
- button/link yang tidak terhubung ke behavior,
- placeholder dashboard metric yang terlihat seperti data real.

Pertahankan accessibility: keyboard navigation, visible focus, semantic HTML, label form, contrast, responsive layout, dan reduced-motion respect.

## 6. Domain Invariants

- Role user hanya `student` atau `teacher` dan immutable setelah onboarding.
- Satu classroom dimiliki satu teacher; teacher dapat memiliki banyak classroom.
- Join key unik dan dapat direvoke/regenerate teacher.
- Siswa dapat menjadi member lebih dari satu classroom.
- Assignment selalu scoped ke satu classroom.
- `maxAttempts` tidak boleh dilewati.
- Teacher hanya dapat review submission untuk classroom yang dimilikinya.
- `approved` adalah terminal kecuali ada explicit reopen feature di PRD.
- `isLate` adalah atribut turunan dari due date/submittedAt, bukan pengganti review status.
- Satu teacher hanya memiliki satu active voice profile.
- Cross-class/cross-user access harus fail closed.
- Raw practice audio bersifat temporary kecuali sesi membutuhkan teacher review/retention.

## 7. Required Verification Per Phase

Minimal:
1. Typecheck/lint.
2. Unit test logic yang berubah.
3. Integration test untuk external/API boundary yang berubah.
4. Manual/E2E test happy path.
5. Minimal satu edge/failure path.
6. Verifikasi no dead interaction dan no simulated success.
7. Update checklist phase dan changelog teknis bila relevan.

Untuk auth/data:
- uji unauthorized, wrong role, wrong class, revoked join key.

Untuk assignment:
- uji due date, max attempts, returned→resubmit, approve, Drive failure.

Untuk AI:
- uji provider timeout, malformed output, unavailable model, retry.

Untuk offline:
- uji offline refresh, queued mutation, duplicate reconnect, quota cleanup.

Untuk hardware:
- uji invalid device credential, offline queue, reconnect, unauthorized MQTT topic.

## 8. Security Rules

- Validate input di server meskipun client sudah validate.
- Rate limit join-key, AI, upload, voice enrollment, dan public-ish endpoints.
- Environment secrets tidak boleh masuk git, build logs, browser bundle, atau Firestore client documents.
- Gunakan OAuth state/PKCE bila flow/provider mendukung.
- Validasi file MIME/extension/size; sanitize filename.
- Terapkan CSP/security headers sesuai Netlify.
- Jalankan dependency vulnerability scan sebelum release.
- Jangan log raw credential, access token, voice sample, atau full student audio.

## 9. Credential Gates

Credential yang mungkin perlu diminta saat phase terkait:
- Firebase project config dan service credentials yang sesuai.
- Google OAuth client untuk Drive.
- AI base/tunnel URL.
- AI API key.
- STT/LLM/TTS model IDs bila endpoint membutuhkannya.
- MQTT broker/device CA/cert/credential bila hardware phase.

Jangan membuat dummy credential yang menghasilkan simulated success. Local mock hanya boleh digunakan pada test environment dan harus jelas berlabel mock.

## 10. Definition of Done

Proyek belum selesai hanya karena UI terlihat lengkap. Done berarti:
- behavior end-to-end bekerja,
- acceptance criteria PRD terpenuhi,
- data permission benar,
- external integration nyata atau berhenti jelas pada credential gate,
- unit/integration/E2E relevant hijau,
- offline/error states teruji,
- QA dan Security phase lulus,
- tidak ada placeholder/dead interaction/simulated success yang masquerade sebagai fitur selesai.
