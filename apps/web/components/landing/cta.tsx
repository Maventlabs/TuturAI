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
          className="relative overflow-hidden rounded-4xl bg-accent px-6 py-14 text-center text-accent-foreground sm:px-12 sm:py-20"
        >
          <div className="pointer-events-none absolute inset-0 -z-0 opacity-20">
            <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-primary blur-3xl" />
            <div className="absolute -bottom-10 -left-10 h-64 w-64 rounded-full bg-brand blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-balance font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
              Mulai bicara Bahasa Inggris dengan percaya diri hari ini
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-accent-foreground/85">
              Gratis untuk siswa, mudah untuk guru. Tidak perlu kartu kredit.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                className="h-12 bg-background px-7 text-base text-foreground hover:bg-background/90"
                asChild
              >
                <Link href="/auth/sign-up">Daftar Gratis</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 border-accent-foreground/30 bg-transparent px-7 text-base text-accent-foreground hover:bg-accent-foreground/10"
                asChild
              >
                <Link href="/auth/login">Sudah punya akun?</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
