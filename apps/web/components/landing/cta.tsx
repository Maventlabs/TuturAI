'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { GSAPLines, GSAPReveal } from './gsap-helpers'

export function CTA() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="rounded-lg bg-primary px-6 py-16 sm:px-12 sm:py-24">
          <GSAPLines>
            <h2 className="max-w-3xl font-display text-4xl font-medium leading-[1.06] tracking-[-0.02em] text-primary-foreground text-balance sm:text-5xl lg:text-6xl">
              <span data-line className="block">
                Berhenti menunda bicara.
              </span>
              <span data-line className="block">
                Mulai satu sesi hari ini.
              </span>
            </h2>
          </GSAPLines>

          <GSAPReveal delay={0.12}>
            <p className="mt-6 max-w-xl leading-relaxed text-primary-foreground/80 text-pretty">
              Gratis untuk siswa, tanpa kartu kredit. Guru bisa langsung mendaftarkan kelasnya.
            </p>
            <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Link
                href="/auth/sign-up"
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-card px-7 text-base font-semibold text-foreground transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
              >
                Mulai Latihan Gratis
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <Link
                href="/auth/login"
                className="text-sm font-semibold text-primary-foreground/85 underline decoration-primary-foreground/30 underline-offset-4 transition-colors hover:text-primary-foreground"
              >
                Sudah punya akun? Masuk
              </Link>
            </div>
          </GSAPReveal>
        </div>
      </div>
    </section>
  )
}
