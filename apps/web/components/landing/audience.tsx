'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'

const studentPoints = [
  'Latihan tanpa takut salah atau ditertawakan',
  'Feedback langsung untuk pelafalan & grammar',
  'Streak, XP, dan badge yang bikin semangat',
]

const teacherPoints = [
  'Dashboard progres tiap siswa secara real-time',
  'Deteksi siswa yang butuh perhatian khusus',
  'Beri tugas speaking dan pantau pengerjaannya',
]

export function Audience() {
  return (
    <section id="untuk-siapa" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl space-y-20 px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Untuk Siapa
          </p>
          <h2 className="mt-3 text-balance font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Satu platform, untuk siswa dan guru
          </h2>
        </div>

        {/* Students */}
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Untuk Siswa
            </span>
            <h3 className="mt-4 font-heading text-2xl font-bold text-foreground sm:text-3xl">
              Percaya diri berbicara, satu sesi setiap hari
            </h3>
            <ul className="mt-6 space-y-3">
              {studentPoints.map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-success/15 text-success">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm text-muted-foreground">{p}</span>
                </li>
              ))}
            </ul>
            <Button className="mt-7" asChild>
              <Link href="/auth/sign-up">Daftar sebagai Siswa</Link>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
            className="overflow-hidden rounded-3xl border border-border bg-card shadow-lg"
          >
            <Image
              src="/hero-student.png"
              alt="Siswa berlatih speaking dengan TuturAI"
              width={640}
              height={520}
              className="h-full w-full object-cover"
            />
          </motion.div>
        </div>

        {/* Teachers */}
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
            className="order-2 overflow-hidden rounded-3xl border border-border bg-card shadow-lg lg:order-1"
          >
            <Image
              src="/teacher-dashboard.png"
              alt="Guru memantau analitik kelas di TuturAI"
              width={640}
              height={520}
              className="h-full w-full object-cover"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
            className="order-1 lg:order-2"
          >
            <span className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
              Untuk Guru
            </span>
            <h3 className="mt-4 font-heading text-2xl font-bold text-foreground sm:text-3xl">
              Pantau kelas tanpa repot mengoreksi satu per satu
            </h3>
            <ul className="mt-6 space-y-3">
              {teacherPoints.map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent/15 text-accent">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm text-muted-foreground">{p}</span>
                </li>
              ))}
            </ul>
            <Button className="mt-7" variant="outline" asChild>
              <Link href="/auth/sign-up">Daftar sebagai Guru</Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
