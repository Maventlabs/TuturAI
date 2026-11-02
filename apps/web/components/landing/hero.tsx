'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mic, TrendingUp } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative pt-28 pb-16 sm:pt-32 sm:pb-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <Badge className="mb-5 gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary">
            <Mic className="h-3.5 w-3.5 text-primary" />
            Safe speaking environment untuk siswa SMA/SMK
          </Badge>

          <h1 className="text-balance font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Latihan <span className="text-primary">Speaking</span> Bahasa Inggris,
            kapan saja tanpa rasa malu
          </h1>

          <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            TuturAI membantu siswa SMA/SMK Indonesia berbicara lebih percaya diri
            lewat partner AI yang sabar, feedback instan soal pronunciation, dan
            tantangan harian yang seru. Guru mendapat dashboard analitik untuk
            memantau perkembangan kelas.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="h-12 px-6 text-base" asChild>
              <Link href="/auth/sign-up">Mulai Latihan Gratis</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-6 text-base"
              asChild
            >
              <Link href="#cara-kerja">Lihat Cara Kerja</Link>
            </Button>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Gratis untuk siswa. Tidak perlu kartu kredit.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
          className="relative"
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Image
              src="/hero-student.webp"
              alt="Siswa SMA berlatih speaking Bahasa Inggris menggunakan TuturAI"
              width={720}
              height={720}
              priority
              className="h-full w-full object-cover"
            />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
