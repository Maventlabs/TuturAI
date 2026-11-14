# Device API Contract (ESP32)

Kontrak ini adalah satu-satunya jalur yang dipakai firmware untuk pairing, heartbeat, dan status.
Semua endpoint berada di origin aplikasi web (`https://<domain>`), bukan di Netlify Function terpisah.

## 1. Pairing

Guru menekan **Buat kode pairing** di `/guru/perangkat`. Kode tampil 5 karakter (contoh `U7C-SQF`),
berlaku 15 menit, dan hanya bisa dipakai sekali. Siswa mengetik kode itu di perangkat.

```
POST /api/device/pair
content-type: application/json

{ "code": "U7C-SQF", "hardwareId": "AA:BB:CC:DD:EE:FF", "firmware": "1.4.2" }
```

`hardwareId` dan `firmware` opsional. Respons `200`:

```json
{
  "data": {
    "deviceId": "esp32-c34fc344",
    "secret": "OWzYLNIoxrMFgM1JJ9vwvv_vqtDIplHaN9sWyffZqlI",
    "heartbeatIntervalSeconds": 30,
    "offlineAfterSeconds": 90,
    "heartbeatUrl": "/api/device/heartbeat",
    "statusUrl": "/api/device/status"
  }
}
```

`deviceId` sudah dibuat saat kode pairing dibuat, jadi ID yang tampil di dashboard guru sama dengan
ID yang diterima perangkat. Simpan `deviceId` + `secret` di NVS; `secret` hanya dikirim sekali dan
server hanya menyimpan hash-nya.

Kode salah, kedaluwarsa, atau sudah terpakai → `400`/`404` dengan envelope `{ "error": { "code", "message" } }`.
Perangkat harus kembali ke layar input kode, bukan retry dengan kode yang sama.

## 2. Heartbeat

```
POST /api/device/heartbeat
content-type: application/json
x-device-id: esp32-c34fc344
x-device-secret: <secret>

{ "battery": 82, "signal": 74, "firmware": "1.4.2" }
```

Semua field opsional, tetapi minimal satu harus ada. `battery` dan `signal` adalah integer 0–100.
Field di luar `battery`, `signal`, `firmware`, `hardwareId` membuat request ditolak (`400`).

Respons `200`:

```json
{
  "data": {
    "accepted": true,
    "status": "online",
    "serverTime": "2026-11-13T11:18:32.722Z",
    "heartbeatIntervalSeconds": 30,
    "offlineAfterSeconds": 90
  }
}
```

Kirim setiap 30 detik. Dashboard menandai perangkat `offline` setelah 90 detik tanpa heartbeat.
Kredensial salah atau perangkat sudah dicabut → `401` `UNAUTHENTICATED`; perangkat harus menghapus
kredensial dari NVS dan kembali ke mode pairing.

## 3. Status

```
GET /api/device/status
x-device-id: esp32-c34fc344
x-device-secret: <secret>
```

```json
{
  "data": {
    "deviceId": "esp32-c34fc344",
    "status": "online",
    "battery": 82,
    "signal": 74,
    "firmware": "1.4.2",
    "lastSyncAt": "2026-11-13T11:18:32.664Z",
    "pairedAt": "2026-11-13T11:18:20.484Z",
    "serverTime": "2026-11-13T11:18:33.093Z",
    "heartbeatIntervalSeconds": 30,
    "offlineAfterSeconds": 90
  }
}
```

Dipakai saat boot untuk memastikan kredensial di NVS masih valid sebelum masuk layar utama.

## 4. Siklus hidup kredensial

- Guru menekan **Cabut** di dashboard → dokumen perangkat dihapus dan `secret` langsung tidak valid.
- Perangkat yang menerima `401` wajib menghapus `deviceId`/`secret` dari NVS lalu menampilkan layar pairing.
- Satu kode pairing hanya untuk satu perangkat. Membuat kode baru tidak memengaruhi perangkat lain.

## 5. Verifikasi

`apps/web/scripts/e2e-device-monitoring.mjs` menjalankan alur penuh (pairing lewat UI, heartbeat,
roster online, cabut, lalu memastikan `401`). Jalankan dengan dev server aktif:

```bash
cd apps/web && node --env-file-if-exists=.env.development.local scripts/e2e-device-monitoring.mjs
```

`BASE_URL` bisa diarahkan ke origin lain (default `http://localhost:3000`).
