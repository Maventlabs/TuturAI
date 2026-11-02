# TuturAI — Arsitektur AI & Sistem (Proposal Concept)

> Dokumen ini merangkum keputusan arsitektur AI yang disepakati, untuk dipakai
> sebagai konteks saat menyusun proposal. Setiap komponen dijelaskan dengan
> peran, alur kerja, dan spesifikasi teknis.

---

## 1. Gambaran Sistem

TuturAI adalah perangkat latihan *speaking* bahasa Inggris dengan umpan balik
multidimensi. Sistem bekerja hibrida: **cloud** (server) untuk penilaian
lengkap, **edge** (perangkat) untuk latihan offline. Dua mode operasi:

| Mode | Platform | Konektivitas | Kemampuan |
|---|---|---|---|
| **PWA** | Browser (Netlify) | Online | Penilaian lengkap 5 dimensi, transkripsi, voice clone, analytics guru |
| **IoT** | ESP32-S3 (firmware) | Online + Offline | Latihan mandiri tanpa ponsel, skor offline (fluency), sync ke cloud |

---

## 2. Komponen AI yang Digunakan

### 2.1 ASR (Automatic Speech Recognition) — wav2vec2-indonesian-javanese-sundanese

| Atribut | Nilai |
|---|---|
| **Model** | `indonesian-nlp/wav2vec2-indonesian-javanese-sundanese` (HuggingFace) |
| **Base model** | `facebook/wav2vec2-large-xlsr-53` |
| **Data latih** | Indonesian Common Voice + Javanese SLR41 + Sundanese SLR44 |
| **Sample rate** | 16 kHz (sesuai capture firmware) |
| **License** | Apache 2.0 |
| **Deployment** | Self-hosted (FastAPI wrapper, expose `/audio/transcriptions`) |

**Peran:** Transkripsi ucapan siswa menjadi teks. Digunakan di PWA (audio upload path) dan IoT (cloud path setelah device upload audio).

**Cara kerja:**
1. Audio PCM16 16kHz diterima server
2. Model wav2vec2 melakukan CTC decoding → teks
3. Teks dikirim ke LLM untuk penilaian

**Keterbatasan:** CTC model — output hanya teks, **tanpa word-level timestamps**. Untuk pronunciation scoring (fonem alignment), diperlukan forced alignment terpisah (Montreal Forced Aligner atau Whisper sebagai secondary).

**Alasan dipilih:** Akurasi aksen Indonesia/Jawa/Sunda jauh lebih baik dari Whisper base. Open-source, bisa self-host.

---

### 2.2 LLM (Large Language Model) — Gemini 3.7 Flash + 3.6 (backup)

| Atribut | Nilai |
|---|---|
| **Model utama** | Gemini 3.7 Flash |
| **Model backup** | Gemini 3.6 |
| **Endpoint** | OpenAI-compatible (`/chat/completions`) via 9router (self-hosted) |
| **Format** | JSON object (`response_format: { type: 'json_object' }`) |
| **Temperature** | 0 (deterministik) |

**Peran:** Penilaian 5 dimensi (pronunciation, fluency, intonation, grammar, vocabulary) dari transkrip. Menghasilkan feedback teks.

**Cara kerja:**
1. Server menerima transkrip dari STT
2. Kirim prompt ke LLM: "Assess this speaking transcript..."
3. LLM mengembalikan JSON dengan 5 skor (0-100) + feedback
4. Server memvalidasi JSON, menghitung overall score (bukan LLM)
5. Hasil disimpan ke Firestore

**System prompt (ringkas):**
```
Return JSON only with pronunciation, fluency, intonation, grammar, vocabulary,
overall, transcript, feedback, and confidence. Scores 0-100.
Do not invent overall score; server recalculates it.
```

**Alasan dipilih:** Murah, cepat (1-2s), multilingual (Indonesia bagus), OpenAI-compatible (mudah switch model). Model routing di server 9router memungkinkan fallback 3.7→3.6 tanpa perubahan client.

---

### 2.3 TTS / Voice Clone — OmniVoice (self-hosted)

| Atribut | Nilai |
|---|---|
| **Model** | `k2-fsa/OmniVoice` (HuggingFace) |
| **RTF (real-time factor)** | 0.025 (40x lebih cepat dari real-time) |
| **Output** | 24 kHz audio |
| **Voice cloning** | Zero-shot, dari 3 detik audio reference |
| **GPU** | Optional (CPU cukup, GPU lebih cepat) |
| **License** | Apache 2.0 |
| **Deployment** | Self-hosted di laptop (16GB RAM, integrated AMD GPU) |

**Peran:** Voice profile guru. Teacher enroll suara → sistem synthesize feedback audio dengan suara guru. "Suara utama TuturAI" di semua menu.

**Cara kerja:**
1. Teacher upload 3-5 detik audio reference + transcript
2. OmniVoice enroll → `providerVoiceId`
3. Saat assessment selesai, server synthesize feedback text → audio dengan suara teacher
4. Audio feedback dikirim ke device/browser

**Mode operasi:** **Pre-generated** (bukan real-time synthesis). Feedback audio di-generate saat assessment selesai, disimpan sebagai file, lalu device download. Ini lebih reliable dan tidak memblok UI.

**Alasan dipilih:** Open-source, self-hosted (tidak bergantung cloud), RTF sangat cepat, voice cloning zero-shot (tidak perlu training).

---

### 2.4 Edge AI (IoT) — INT8-CNN (DS-CNN) + MFCC

| Atribut | Nilai |
|---|---|
| **Task** | Keyword spotting ≤50 kata, ≤1.5 detik |
| **Feature** | MFCC (49 frame × 10 koefisien, 30ms frame, 20ms hop) |
| **Model** | DS-CNN (Depthwise Separable CNN) |
| **Quantization** | INT8 full quantization |
| **Runtime** | TensorFlow Lite Micro + ESP-NN |
| **Model size** | ≤ 200-300 KB (target) |
| **Inference time** | ~100-150ms di ESP32-S3 |

**Peran:** Latihan offline tanpa internet. Mengenali kata kunci yang dipilih teacher, memberi skor fluency.

**Cara kerja:**
1. Mikrofon capture audio 16kHz
2. VAD (energy-based, adaptive noise floor) mendeteksi ucapan
3. MFCC extraction (49 × 10 INT8)
4. DS-CNN inference → softmax 51 kelas (50 kata + 1 unknown)
5. Skor offline = 0.70 × Sp_offline + 0.30 × Sf_offline
   - Sp_offline = 100 × p_target (probabilitas top-1, jika tersedia)
   - Sf_offline = 100 × (0.6 × WPMnorm + 0.4 × (1 - Rpause))
6. Hasil ditandai `OFFLINE_EDGE` (bukan skor kanonik)

**Keterbatasan:** Offline score hanya fluency. Pronunciation dan intonation membutuhkan audio asli (server-side), jadi berstatus `insufficient_evidence` dan tidak dikarang.

**Status:** Firmware sudah siap (MFCC + inference pipeline). Model belum ada — perlu training terpisah (Edge Impulse atau manual TensorFlow).

---

## 3. Alur Data (Data Flow)

### 3.1 PWA Mode (Online)

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Browser     │────►│  Netlify     │────►│  STT (wav2vec2│────►│  LLM (Gemini)│
│  Web Speech  │     │  Functions   │     │  self-hosted) │     │  via 9router │
│  API / Audio │     │              │     │              │     │              │
└─────────────┘     └──────────────┘     └──────────────┘     └──────┬───────┘
                                                                    │
                                                                    ▼
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Device/     │◄────│  TTS (Omni   │◄────│  Scoring     │◄────│  Firestore   │
│  Browser     │     │  Voice)      │     │  Validation  │     │  (durable)   │
│  (playback)  │     │  (pre-gen)   │     │              │     │              │
└─────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### 3.2 IoT Mode (Offline)

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  ESP32-S3   │────►│  VAD (energy)│────►│  MFCC        │────►│  DS-CNN      │
│  INMP441    │     │  + AGC       │     │  (49x10 INT8)│     │  (INT8, on   │
│  mic        │     │              │     │              │     │  device)     │
└─────────────┘     └──────────────┘     └──────────────┘     └──────┬───────┘
                                                                    │
                                                                    ▼
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  TFT Display│◄────│  Offline Score│◄────│  Fluency     │
│  (LVGL)     │     │  (fluency     │     │  (WPM, pause │
│             │     │  only)        │     │  ratio)      │
└─────────────┘     └──────────────┘     └──────────────┘
```

### 3.3 IoT Mode (Online)

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  ESP32-S3   │────►│  WAV writer  │────►│  HTTPS upload│────►│  Server      │
│  (record)   │     │  (microSD)   │     │  (device     │     │  Whisper STT │
│             │     │              │     │  credential) │     │  + LLM score │
└─────────────┘     └──────────────┘     └──────────────┘     └──────┬───────┘
                                                                    │
                                                                    ▼
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  TFT Display│◄────│  Sync queue  │◄────│  Firestore   │
│  (result)   │     │  (retry)     │     │  (durable)   │
└─────────────┘     └──────────────┘     └──────────────┘
```

---

## 4. Infrastruktur yang Dibutuhkan

| Komponen | Hardware | Peran |
|---|---|---|
| **Server 9router** | VPS / laptop dengan GPU (opsional) | LLM (Gemini via OpenAI-compat), routing model 3.7→3.6 |
| **STT server** | Laptop/server dengan GPU (recommended) | wav2vec2 inference (16kHz, CTC) |
| **TTS server** | Laptop teman (16GB RAM, integrated AMD GPU) | OmniVoice voice clone + synthesis |
| **MQTT broker** | Mosquitto 2.x (TLS, port 8883) | Presence, telemetry, config, command |
| **Bridge** | Node.js (mqtt.js + firebase-admin) | MQTT → Firestore (max 1 write/60s per device) |
| **Web** | Netlify | PWA hosting, serverless functions |
| **Database** | Firebase Firestore | Durable data, auth, security rules |

---

## 5. Keputusan yang Sudah Dikunci

| Keputusan | Pilihan | Alasan |
|---|---|---|
| STT model | wav2vec2-indonesian-javanese-sundanese | Akurasi Indonesia terbaik, open-source |
| LLM | Gemini 3.7 Flash + 3.6 backup | Murah, cepat, multilingual, JSON mode |
| LLM endpoint | OpenAI-compatible via 9router | Model routing 3.7→3.6 tanpa perubahan client |
| TTS | OmniVoice self-hosted | Open-source, voice clone, RTF 0.025 |
| TTS mode | Pre-generated (bukan real-time) | Reliable, tidak blok UI |
| Edge model | DS-CNN + MFCC + INT8 + TFLite Micro | Standar industri keyword spotting |
| Edge runtime | TFLite Micro + ESP-NN | 2-4x speedup di ESP32-S3 |
| Edge inference | Offline, ≤50 kata, ≤1.5s | Latihan tanpa internet |
| Offline score | Fluency only (pronunciation/intonation = insufficient evidence) | Tidak fabrikasi skor dari teks |

---

## 6. Yang Belum Ada (Butuh Pengerjaan)

| Item | Status | Estimasi |
|---|---|---|
| Model INT8-CNN untuk KWS | Belum ada | 2-3 hari (Edge Impulse) + data collection |
| wav2vec2 wrapper (OpenAI-compat) | Belum ada | 1 hari (FastAPI) |
| OmniVoice wrapper (voice clone endpoints) | Belum ada | 1 hari (FastAPI) |
| Forced alignment (pronunciation) | Belum ada | 2-3 hari (MFA atau Whisper secondary) |
| Training data KWS (50 kata × 100 sample) | Belum ada | 1-2 minggu (collection) |

---

## 7. Catatan Penting untuk Proposal

1. **Tidak ada model yang "ajaib"** — setiap komponen punya trade-off. wav2vec2 akurat Indonesia tapi tidak ada timestamps. Gemini cepat tapi perlu test JSON output. OmniVoice cepat tapi butuh server. DS-CNN kecil tapi perlu data training.

2. **Sistem provider-agnostic** — format API yang terkunci (OpenAI-compatible), bukan nama model. Ini berarti model bisa diganti tanpa perubahan kode.

3. **Offline score jujur** — sistem tidak fabrikasi skor. Jika metric tidak bisa dihitung dari evidence yang ada, statusnya `insufficient_evidence`, bukan `0` atau angka palsu.

4. **Hardware roadmap** — perangkat ESP32-S3 tetap satu produk TuturAI. Firmware sudah siap menerima model (MFCC + inference pipeline), tapi modelnya sendiri belum ada.
