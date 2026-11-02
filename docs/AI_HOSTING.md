# TuturAI — AI Hosting & Self-Hosted Pipeline

> Dokumen ini merangkum infrastruktur AI self-hosted yang dibutuhkan TuturAI.
> Semua komponen berjalan di server/laptop sendiri (bukan cloud provider).

---

## 1. Komponen AI & Peran

### 1.1 STT (Speech-to-Text) — wav2vec2-indonesian-javanese-sundanese

| Atribut | Nilai |
|---|---|
| **Model** | `indonesian-nlp/wav2vec2-indonesian-javanese-sundanese` |
| **Base** | `facebook/wav2vec2-large-xlsr-53` |
| **Input** | 16kHz audio |
| **Output** | Teks (CTC, tanpa timestamps) |
| **License** | Apache 2.0 |
| **Deployment** | Self-hosted FastAPI wrapper |

**Cara kerja:**
1. Audio PCM16 16kHz diterima server
2. Resample ke 16kHz (jika perlu)
3. Model wav2vec2 melakukan CTC decoding → teks
4. Teks dikirim ke LLM untuk penilaian

**Wrapper yang dibutuhkan:** FastAPI yang expose `/audio/transcriptions` (OpenAI-compatible) dan forward ke model. Format input: `FormData` dengan `file`, `model`, `language`.

**Keterbatasan:** CTC = tanpa word-level timestamps. Untuk pronunciation scoring, butuh forced alignment terpisah.

**Hardware minimum:** GPU recommended (8GB VRAM). CPU bisa tapi inference 2-5s per audio 5s.

---

### 1.2 LLM (Scoring) — Gemini 3.7 Flash + 3.6 (backup)

| Atribut | Nilai |
|---|---|
| **Model utama** | Gemini 3.7 Flash |
| **Model backup** | Gemini 3.6 |
| **Endpoint** | OpenAI-compatible `/chat/completions` |
| **Routing** | 9router (self-hosted) — model routing 3.7→3.6 |
| **Temperature** | 0 (deterministik) |
| **Format output** | JSON object |

**Cara kerja:**
1. Server menerima transkrip dari STT
2. Kirim prompt ke LLM via 9router
3. 9router route ke Gemini 3.7 (fallback 3.6 jika gagal)
4. LLM mengembalikan JSON: 5 skor (0-100) + feedback
5. Server validasi JSON, hitung overall score (bukan LLM)
6. Hasil disimpan ke Firestore

**System prompt (ringkas):**
```
Return JSON only with pronunciation, fluency, intonation, grammar, vocabulary,
overall, transcript, feedback, confidence. Scores 0-100.
Do not invent overall score; server recalculates it.
```

**Hardware:** Tidak perlu GPU (API call ke Google). Hanya butuh server dengan internet.

---

### 1.3 TTS / Voice Clone — OmniVoice (self-hosted)

| Atribut | Nilai |
|---|---|
| **Model** | `k2-fsa/OmniVoice` (HuggingFace) |
| **RTF** | 0.025 (40x real-time) |
| **Output** | 24 kHz audio |
| **Voice cloning** | Zero-shot, dari 3 detik audio |
| **GPU** | Optional (CPU cukup) |
| **License** | Apache 2.0 |
| **Deployment** | Self-hosted: `omnivoice-demo --ip 0.0.0.0 --port 8001` |

**Cara kerja:**
1. Teacher enroll suara (upload 3-5s audio + transcript)
2. OmniVoice enroll → `providerVoiceId`
3. Saat assessment selesai, server synthesize feedback text → audio dengan suara teacher
4. Audio feedback disimpan sebagai file, device download

**Mode operasi:** Pre-generated (bukan real-time). Feedback audio di-generate saat assessment selesai.

**Wrapper yang dibutuhkan:** FastAPI yang expose:
- `POST /v1/voice-clones` (enrollment: audio + ref_text → id + status)
- `GET /v1/voice-clones/{id}` (status polling)
- `DELETE /v1/voice-clones/{id}` (delete)
- `POST /v1/audio/speech` (synthesis: voice_id + text → audio)

**Hardware minimum:** 16GB RAM, integrated GPU OK. CPU inference cukup cepat (RTF 0.025).

---

### 1.4 Edge AI (IoT) — INT8-CNN (DS-CNN) + MFCC

| Atribut | Nilai |
|---|---|
| **Task** | Keyword spotting ≤50 kata, ≤1.5 detik |
| **Feature** | MFCC (49 frame × 10 koefisien) |
| **Model** | DS-CNN (Depthwise Separable CNN) |
| **Quantization** | INT8 full |
| **Runtime** | TFLite Micro + ESP-NN |
| **Model size** | ≤ 200-300 KB |
| **Inference** | ~100-150ms di ESP32-S3 |

**Cara kerja:**
1. Mikrofon capture audio 16kHz
2. VAD (energy-based, adaptive noise floor) mendeteksi ucapan
3. MFCC extraction (49 × 10 INT8)
4. DS-CNN inference → softmax 51 kelas (50 kata + 1 unknown)
5. Skor offline = 0.70 × Sp + 0.30 × Sf
6. Hasil ditandai `OFFLINE_EDGE`

**Status:** Firmware siap. Model belum ada — perlu training (Edge Impulse, 2-3 hari + data collection).

---

## 2. Infrastruktur Self-Hosted

```
┌─────────────────────────────────────────────────────────────┐
│  Laptop Server (16GB RAM, integrated AMD GPU)               │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ wav2vec2    │  │ OmniVoice   │  │ 9router     │        │
│  │ FastAPI     │  │ FastAPI     │  │ (LLM proxy) │        │
│  │ port 8000   │  │ port 8001   │  │ port 8002   │        │
│  │ STT         │  │ TTS/clone   │  │ → Gemini    │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │
│         └────────────────┴────────────────┘                │
│                          │                                 │
│  ┌───────────────────────┴───────────────────────┐         │
│  │  Mosquitto MQTT (TLS, port 8883)              │         │
│  │  + Bridge (Node.js: mqtt.js + firebase-admin) │         │
│  └───────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Netlify (PWA)                                              │
│  Next.js + Serverless Functions                             │
│  → Firestore (durable data)                                 │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  ESP32-S3 Device                                            │
│  Firmware (Arduino/LVGL)                                    │
│  → MQTT (presence/telemetry) + HTTPS (audio upload)         │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Alur Data (End-to-End)

### PWA Mode (Online)

```
1. Siswa buka browser → Web Speech API transkripsi (client-side)
   ATAU upload audio → server Whisper/wav2vec2
2. Transkrip → LLM (Gemini via 9router) → 5 skor + feedback
3. Feedback text → OmniVoice TTS → audio dengan suara teacher
4. Audio feedback → browser playback
5. Hasil → Firestore (durable)
```

### IoT Mode (Offline)

```
1. Device rekam audio (INMP441, 16kHz)
2. VAD mendeteksi ucapan
3. MFCC extraction (49×10 INT8)
4. DS-CNN inference → keyword + confidence
5. Skor offline = fluency only (pronunciation/intonation = insufficient evidence)
6. Tampil di TFT (LVGL)
7. Audio disimpan ke microSD queue
```

### IoT Mode (Online)

```
1. Device rekam audio → WAV writer (microSD)
2. Queue → HTTPS upload (streaming, device credential)
3. Server: Whisper/wav2vec2 STT → LLM score
4. Hasil → device (TFT display) + Firestore
5. Queue item dihapus setelah server 2xx
```

---

## 4. Konfigurasi Environment

```env
# STT (wav2vec2 self-hosted)
AI_STT_ROUTE=local
AI_LOCAL_BASE_URL=http://<laptop-ip>:8000
AI_LOCAL_API_KEY=  (opsional)
AI_STT_MODEL_ID=wav2vec2-indonesian

# LLM (Gemini via 9router)
AI_LLM_ROUTE=v1
AI_V1_BASE_URL=http://<9router-ip>:8002/v1
AI_V1_API_KEY=<9router-key>
AI_LLM_MODEL_ID=gemini-3.7-flash

# TTS (OmniVoice)
AI_TTS_ROUTE=local
AI_TTS_BASE_URL=http://<laptop-ip>:8001
AI_TTS_MODEL_ID=omnivoice
AI_TTS_ENROLLMENT_PATH=/v1/voice-clones
AI_TTS_SYNTHESIS_PATH=/v1/audio/speech

# Pronunciation
AI_PRONUNCIATION_ROUTE=v1
AI_PRONUNCIATION_BASE_URL=http://<9router-ip>:8002/v1
AI_PRONUNCIATION_MODEL_ID=gemini-3.7-flash
AI_PRONUNCIATION_PATH=/chat/completions
```

---

## 5. Yang Perlu Dibangun (Belum Ada)

| Item | Estimasi | Keterangan |
|---|---|---|
| wav2vec2 FastAPI wrapper | 1 hari | Expose `/audio/transcriptions` (OpenAI-compat) |
| OmniVoice FastAPI wrapper | 1 hari | Expose `/v1/voice-clones` + `/v1/audio/speech` |
| 9router setup | 0.5 hari | LLM proxy dengan model routing 3.7→3.6 |
| Forced alignment (pronunciation) | 2-3 hari | MFA atau Whisper secondary untuk word timestamps |
| Edge Impulse KWS training | 2-3 hari + data | 50 kata × 100 sample × 10 speaker |
| Mosquitto + bridge | 0.5 hari | MQTT TLS + Firestore bridge |

---

## 6. Catatan Penting

1. **Tidak ada model "ajaib"** — setiap komponen punya trade-off. wav2vec2 akurat Indonesia tapi tidak ada timestamps. Gemini cepat tapi perlu test JSON output. OmniVoice cepat tapi butuh server. DS-CNN kecil tapi perlu data training.

2. **Sistem provider-agnostic** — format API yang terkunci (OpenAI-compatible), bukan nama model. Model bisa diganti tanpa perubahan kode.

3. **Offline score jujur** — sistem tidak fabrikasi skor. Jika metric tidak bisa dihitung, status `insufficient_evidence`.

4. **Hardware roadmap** — perangkat ESP32-S3 tetap satu produk TuturAI. Firmware siap menerima model, tapi modelnya sendiri belum ada.
