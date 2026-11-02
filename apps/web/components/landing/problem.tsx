'use client'

import { motion } from 'framer-motion'
import { MicOff, MessageSquareOff, Clock, Users } from 'lucide-react'

const problems = [
  {
    icon: MicOff,
    title: 'Mute English',
    desc: 'Siswa memahami bahasa Inggris secara pasif tapi tidak berani berbicara. Takut salah, takut ditertawakan.',
  },
  {
    icon: MessageSquareOff,
    title: 'Speaking Anxiety',
    desc: 'Foreign Language Speaking Anxiety (FLSA) membuat siswa menghindari partisipasi aktif di kelas.',
  },
  {
    icon: Users,
    title: 'Kelas Padat',
    desc: '1 guru untuk 35 siswa. Tidak ada waktu untuk feedback personal yang objektif dan konsisten.',
  },
  {
    icon: Clock,
    title: 'Ketergantungan Internet',
    desc: 'Solusi cloud-only tidak relevan untuk sekolah di wilayah 3T dengan koneksi tidak stabil.',
  },
]

export function Problem() {
  return (
    <section className="bg-secondary/50 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Masalah
          </p>
          <h2 className="mt-3 text-balance font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Mengapa siswa Indonesia sulit berbicara Bahasa Inggris?
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Bukan karena tidak tahu grammar. Tapi karena takut, malu, dan tidak
            ada tempat latihan yang aman.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {problems.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
            >
              <div className="h-full rounded-2xl border border-border bg-card p-6">
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <p.icon className="h-5 w-5" />
                </span>
                <h3 className="font-heading text-base font-bold text-foreground">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {p.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
