'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'

export function CTA() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-border bg-card px-6 py-14 text-center sm:px-12 sm:py-20"
        >
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-balance font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
              Mulai bicara Bahasa Inggris dengan percaya diri hari ini
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground">
              Gratis untuk siswa, mudah untuk guru. Tidak perlu kartu kredit.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" className="h-12 px-7 text-base" asChild>
                <Link href="/auth/sign-up">Daftar Gratis</Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-7 text-base" asChild>
                <Link href="/auth/login">Sudah punya akun?</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
