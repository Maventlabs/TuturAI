'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mic, Sparkles, TrendingUp, Star, Flame } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-24">
      {/* soft background wash */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 right-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-40 -left-20 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <Badge className="mb-5 gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Didukung AI untuk Kurikulum Merdeka
          </Badge>

          <h1 className="text-balance font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Latihan <span className="text-primary">Speaking</span> Bahasa Inggris,
            kapan saja tanpa rasa malu
          </h1>

          <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            TuturAI membantu siswa SMA/SMK Indonesia berbicara lebih percaya diri
            lewat partner AI yang sabar, feedback instan soal pronunciation, dan
            tantangan harian yang seru.
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

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-brand text-brand" />
              <span className="font-semibold text-foreground">4.9</span> rating guru
            </span>
            <span className="h-4 w-px bg-border" />
            <span>
              <span className="font-semibold text-foreground">12.000+</span> sesi
              speaking diselesaikan
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
          className="relative"
        >
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
            <Image
              src="/hero-student.png"
              alt="Siswa SMA berlatih speaking Bahasa Inggris menggunakan TuturAI"
              width={720}
              height={720}
              priority
              className="h-full w-full object-cover"
            />
          </div>

          {/* floating cards */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="absolute -left-3 top-10 flex items-center gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur sm:-left-6"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Mic className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Pronunciation</p>
              <p className="text-sm font-bold text-foreground">92% akurat</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.5 }}
            className="absolute -right-3 bottom-10 flex items-center gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur sm:-right-6"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15 text-success">
              <TrendingUp className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Streak harian</p>
              <p className="flex items-center gap-1 text-sm font-bold text-foreground">
                <Flame className="h-4 w-4 text-brand" /> 7 hari
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
