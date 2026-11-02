# TuturAI Device Firmware — ESP32-S3 (IoT)

> Dokumen tunggal untuk firmware perangkat. Menggantikan `FIRMWARE_PLAN.md`,
> `firmware-evidence.md`, dan `LIDM_Firmware.md` (hardware spec). Semua referensi
> ke tiga file itu sekarang ke sini.

---

## 1. Status Saat Ini (24 Okt 2026)

| Aset | Status |
|---|---|
| Firmware source (ESP-IDF) | `apps/firmware/` — ada, belum di-flash (idf.py tidak terpasang) |
| Firmware source (Arduino) | `apps/firmware/arduino/TuturAI_Device/TuturAI_Device.ino` + `lv_conf.h` — **siap compile** |
| LVGL UI | 8 layar + keypad on-device, precision-blue theme |
| Audio chain | DC blocker → limiter → AGC → VAD → WAV writer → upload streaming |
| Koneksi | WiFi + MQTT-TLS + HTTPS upload (streaming) |
| Storage | NVS (config + secret), SPIFFS (lessons), microSD (queue) |
| Self-test | 8-item boot screen, jujur (tidak ada fake PASS) |
| Hardware | Belum dibeli/fisik — semua FW task butuh alat (gate manusia) |
| Broker MQTT | Belum ada (Mosquitto + bridge belum di-deploy) |

**Progress firmware: ~30% (server-side registry done, firmware source done, belum di-flash/test)**

---

## 2. Hardware Target

| Komponen | Spesifikasi | Peran firmware |
|---|---|---|
| MCU | ESP32-S3 DevKitC-1 N16R8 (16MB flash, 8MB PSRAM) | Core 0: input/net/storage/LED. Core 1: audio/UI |
| Display | TFT ILI9488 3.5" 320×480 + XPT2046 touch | Status UI (LVGL 9) |
| Mic | INMP441 (I2S, 16kHz) | Audio capture, left slot |
| Amp | MAX98357A (I2S) | Audio playback, 8Ω load (2×4Ω seri) |
| Input | KY-023 joystick + 8 tombol | Navigasi, rekam |
| LED | WS2812B (RMT) | Status indicator |
| Storage | microSD (SPI) | Queue audio, lessons |
| Power | LiPo 3.7V 5000mAh + TP4056 + boost | ≥4.5 jam target |

**Pin map** (sumber: `apps/firmware/components/tuturai_pure/include/tuturai/pins.hpp`):

| Net | GPIO | Catatan |
|---|---|---|
| I2S WS/LRC | 4 | Mic + Amp shared |
| I2S SCK/BCLK | 5 | 1.024 MHz |
| I2S DIN (mic) | 6 | Left slot |
| I2S DOUT (amp) | 7 | |
| SPI CS (TFT) | 10 | Native SPI2 CS0 |
| SPI MOSI | 11 | Shared |
| SPI SCK | 12 | 15 MHz (ceiling) |
| SPI MISO | 13 | Shared dengan touch + SD |
| TFT DC | 9 | |
| TFT RST | 14 | Active LOW, ≥10ms |
| Touch CS | 15 | Polled |
| SD CS | 17 | |
| Joystick X/Y | 1/2 | ADC1 (ADC2 bentrok WiFi) |
| Joystick click | 8 | Active LOW |
| Buttons B1-B8 | 21,18,16,39,42,38,40,3 | Active LOW, pull-up |
| WS2812B DIN | 41 | RMT, 800kHz |
| UART TX/RX | 43/44 | Debug 115200 |

**Pin terlarang:** 0, 33-37, 45-48 (strapping/PSRAM/1.8V domain)

**Warning hardware (LIDM_Firmware.md):**
- F2: MAX98357A SD_MODE unconnected → amp mungkin mati. Tie ke 3V3 jika silent
- F4: TFT MISO shared → beberapa ILI9488 tidak tri-state MISO saat CS=HIGH, merusak SD read. Pull pin 8 off TFT jika SD gagal mount
- F5: Backlight tied ke 5V rail (tidak controllable) — `BACKLIGHT_ENABLE_PIN` default -1
- F7: Tidak ada battery sense divider → battery dilaporkan "not measurable"

---

## 3. Arsitektur Firmware

### Task FreeRTOS (2 core)

| Task | Core | Prioritas | Stack | Fungsi |
|---|---|---|---|---|
| `audio` | 1 | 6 | 8KB | I2S capture 20ms, DSP, VAD, metering |
| `lvgl` | 1 | 5 | 8KB | UI refresh 30Hz, input poll, LED |
| `net` | 0 | 3 | 10KB | WiFi, MQTT, HTTPS upload, button queue drain |
| `storage` | 0 | 2 | 5KB | Queue housekeeping (2s interval) |
| `house` | 0 | 1 | 5KB | Uptime, heap, backlight, LED state |
| `console` | 0 | 1 | 4KB | Serial command handler |

### Audio Chain (per sample, capture)

```
raw32 (I2S) → DC blocker (α=0.9690776, 80Hz) → Soft limiter (-3dBFS)
→ AGC (asymmetric 0.08/0.002, gain 0.5-4.0) → PCM16 → Ring buffer (PSRAM)
→ VAD (adaptive noise floor, +9dB start, +6dB end, 500ms hangover)
→ WAV writer (temp→rename, atomic) → Queue (microSD)
```

### Audio Chain (per sample, playback)

```
PCM16 → Biquad HPF (≥200Hz) → Volume (default 40%, ceiling 85%)
→ Soft limiter (full scale) → I2S TX → MAX98357A → Speaker (8Ω)
```

### VAD (Adaptive Energy)

- Noise floor = slow minimum of recent RMS (tracked per 20ms frame)
- Speech start: RMS > floor + 9dB selama ≥3 frame (60ms)
- Speech end: RMS < floor + 6dB selama hangover 500ms
- Durasi valid: 0.3s ≤ durasi ≤ 10s
- SNR = peak seen − floor (metrik kualitas recording)

### Tuning Parameters (runtime-adjustable, persist ke NVS)

| Parameter | Default | Range | Fungsi |
|---|---|---|---|
| Input shift | 14 | 8-20 | Konversi 32-bit slot → int16 (+12dB at 14) |
| AGC target | 2500 | 200-12000 | Target amplitude (~-22dBFS) |
| AGC rise | 0.08 | 0.001-0.5 | Gain naik per sample |
| AGC fall | 0.002 | 0.0001-0.5 | Gain turun per sample |
| AGC gain min/max | 0.5/4.0 | 0.25-32 | Batas gain |
| Envelope decay | 0.9995 | 0.9-0.99999 | Smoothing envelope |
| Limiter ceiling | -3 dBFS | -18 to -0.5 | Hard ceiling |
| VAD start | +9 dB | 3-30 | Threshold awal ucapan |
| VAD end | +6 dB | 1 to start-0.5 | Threshold akhir ucapan |
| VAD hangover | 500ms | 50-3000 | Silence sebelum utterance selesai |
| VAD min/max speech | 300ms/10s | 50-30000 | Durasi valid |
| Playback HPF | 200 Hz | 40-1000 | HPF speaker |
| Volume | 40% | 0-85% | Volume playback |

### UI (LVGL 9, precision-blue theme)

8 layar: Boot (self-test), Home, Lesson, Result, Sync (queue), Audio Lab (tuning), Settings, Error. Plus on-device keypad (full QWERTY-ish, 6 row) untuk provisioning tanpa laptop.

### Koneksi & Protokol

**MQTT over TLS (port 8883):**
| Topik | Arah | QoS | Retain | Isi |
|---|---|---|---|---|
| `tuturai/devices/{id}/presence` | device→server | 1 | ya | fw, rssi, uptimeS, ts |
| `tuturai/devices/{id}/telemetry` | device→server | 0 | tidak | battery, signal, firmware, ts |
| `tuturai/devices/{id}/ack` | device→server | 1 | tidak | cmdId, status |
| `tuturai/devices/{id}/config` | server→device | 1 | ya | version, settings |
| `tuturai/devices/{id}/cmd` | server→device | 1 | tidak | cmdId, type (whitelist) |

**HTTPS audio upload:**
- `POST <api_base>/api/device/audio-upload`
- Header: `x-device-id`, `x-device-secret`, `content-type: audio/wav`
- Response: JSON assessment result (5 dimensi + transcript + feedback)

**Command whitelist (MQTT cmd):** reboot, sync_now, play_example, identify, set_mute, set_volume, set_led_brightness. Tidak ada arbitrary command.

### Offline Queue

- File naming: `<millis>-<counter>.wav` (lexical = chronological)
- Write: temp file → fsync → rename (atomic, R-09)
- Trim: oldest-first, max 200 files / 96MB
- Cleanup: abandoned `.part` files >1 jam
- Hapus lokal: hanya setelah server 2xx

### Self-Test (Boot)

8 item: Panel, Touch, microSD, Audio in/out, Joystick+buttons, PSRAM, Free heap, Wi-Fi. Setiap item menampilkan PASS/FAIL berdasarkan probe nyata. Tidak ada fake PASS.

---

## 4. Kontrak API yang WAJIB dipatuhi

**Heartbeat payload (ketat, server menolak key tambahan):**
```json
{ "battery": 87, "signal": 64, "firmware": "0.1.0" }
```
Batas: battery 0-100, signal 0-100, firmware 1-64 char.

**Device credential:** `x-device-id` = pairing code, `x-device-secret` = secret (disimpan terenkripsi di NVS, tidak pernah polos di flash). Server menyimpan `credentialHash`, bukan secret. `credentialVersion` naik setiap rotasi.

**Audio upload:** multipart file, `x-device-id` + `x-device-secret` header. Response: `TuturAIScoringResult` (5 dimensi, transcript, feedback, latencyMs).

---

## 5. Status & Next Steps

| Item | Status |
|---|---|
| Firmware source (ESP-IDF) | Ada, belum di-flash (idf.py tidak terpasang) |
| Firmware source (Arduino) | Siap compile, belum di-flash ke board |
| Hardware | Belum dibeli |
| MQTT broker | Belum di-deploy |
| Edge AI model | Belum ada (firmware siap menerima) |
| Testing | Belum (butuh alat fisik) |

**Gate manusia:** Semua FW task butuh alat fisik. Agent tidak boleh flash ke perangkat tanpa izin eksplisit.
