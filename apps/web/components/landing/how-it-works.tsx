'use client'

import { motion } from 'framer-motion'
import { MousePointerClick, Mic, LineChart } from 'lucide-react'

const steps = [
  {
    icon: MousePointerClick,
    step: '01',
    title: 'Pilih Topik',
    desc: 'Mulai dari skenario sehari-hari, materi sekolah, atau latihan ujian. Tinggal tap satu topik.',
  },
  {
    icon: Mic,
    step: '02',
    title: 'Bicara dengan AI',
    desc: 'Tekan tombol mikrofon dan mulai ngobrol. AI menanggapi secara natural dalam Bahasa Inggris.',
  },
  {
    icon: LineChart,
    step: '03',
    title: 'Dapat Feedback & XP',
    desc: 'Lihat skor pronunciation, koreksi tata bahasa, lalu kumpulkan XP untuk naik level.',
  },
]

export function HowItWorks() {
  return (
    <section
      id="cara-kerja"
      className="scroll-mt-20 bg-secondary/50 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Cara Kerja
          </p>
          <h2 className="mt-3 text-balance font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Tiga langkah sederhana untuk mulai
          </h2>
        </div>

        <div className="relative mt-14 grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              className="relative rounded-3xl border border-border bg-card p-7 shadow-sm"
            >
              <span className="font-heading text-5xl font-extrabold text-primary/15">
                {s.step}
              </span>
              <span className="mt-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <s.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 font-heading text-xl font-bold text-foreground">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {s.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
