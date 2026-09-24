'use client'

import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import {
  Mic,
  Gauge,
  Trophy,
  BarChart3,
  BookOpenCheck,
  ShieldCheck,
} from 'lucide-react'

const features = [
  {
    icon: Mic,
    title: 'Partner Speaking AI',
    desc: 'Ngobrol bebas dengan AI yang sabar 24/7. Tidak ada rasa malu, latihan sebanyak yang kamu mau.',
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    icon: Gauge,
    title: 'Feedback Pronunciation Instan',
    desc: 'Dapatkan skor pelafalan, tata bahasa, dan kelancaran secara langsung setelah bicara.',
    color: 'text-accent',
    bg: 'bg-accent/10',
  },
  {
    icon: Trophy,
    title: 'Gamifikasi & Streak',
    desc: 'Kumpulkan XP, naik level, jaga streak harian, dan bersaing di leaderboard kelas.',
    color: 'text-brand-foreground',
    bg: 'bg-brand/20',
  },
  {
    icon: BookOpenCheck,
    title: 'Materi Kurikulum Merdeka',
    desc: 'Topik dan skenario yang relevan dengan pelajaran sekolah dan ujian Bahasa Inggris.',
    color: 'text-success',
    bg: 'bg-success/15',
  },
  {
    icon: BarChart3,
    title: 'Dashboard Analitik Guru',
    desc: 'Pantau perkembangan tiap siswa, identifikasi kesulitan, dan beri tugas dengan mudah.',
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    icon: ShieldCheck,
    title: 'Aman & Ramah Sekolah',
    desc: 'Data siswa terlindungi, konten terkurasi, dan cocok digunakan di lingkungan kelas.',
    color: 'text-accent',
    bg: 'bg-accent/10',
  },
]

export function Features() {
  return (
    <section id="fitur" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Fitur Unggulan
          </p>
          <h2 className="mt-3 text-balance font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Semua yang dibutuhkan untuk lancar berbicara
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Dirancang khusus untuk konteks belajar siswa Indonesia, dari latihan
            mandiri hingga pemantauan guru.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
            >
              <Card className="group h-full border-border p-6 transition-shadow hover:shadow-md">
                <span
                  className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${f.bg} ${f.color}`}
                >
                  <f.icon className="h-6 w-6" />
                </span>
                <h3 className="font-heading text-lg font-bold text-foreground">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
