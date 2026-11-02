'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { WifiOff, Cpu, Battery, HardDrive } from 'lucide-react'

const capabilities = [
  { icon: WifiOff, title: 'Offline-First', desc: 'Latihan speaking, reading, dan kuis dasar tanpa internet. Hasil disimpan di perangkat, sync otomatis saat online.' },
  { icon: Cpu, title: 'Edge AI', desc: 'DS-CNN INT8 berjalan di ESP32-S3. Deteksi kelancaran dasar tanpa cloud.' },
  { icon: Battery, title: 'Baterai 4.5+ Jam', desc: 'LiPo 3.7V 5000mAh. Cukup untuk satu sesi kelas penuh.' },
  { icon: HardDrive, title: 'Antrean Lokal', desc: 'Rekaman disimpan di microSD. Tidak ada data yang hilang saat koneksi putus.' },
]

export function OfflineHardware() {
  return (
    <section className="bg-secondary/50 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Offline & Hardware
          </p>
          <h2 className="mt-3 text-balance font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Belajar tanpa internet, tanpa ponsel
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            TuturAI hadir sebagai perangkat genggam ESP32-S3 dengan layar TFT,
            mikrofon, dan speaker. Siswa berlatih mandiri — tidak butuh
            smartphone, tidak butuh WiFi. Cocok untuk sekolah di wilayah 3T.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {capabilities.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="rounded-2xl border border-border bg-card p-6 text-left"
            >
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <c.icon className="h-5 w-5" />
              </span>
              <h3 className="font-heading text-base font-bold text-foreground">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.desc}</p>
            </motion.div>
          ))}
        </div>

        <Button className="mt-10" variant="outline" asChild>
          <Link href="/auth/sign-up">Pelajari Lebih Lanjut</Link>
        </Button>
      </div>
    </section>
  )
}
