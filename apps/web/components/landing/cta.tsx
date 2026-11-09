'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { GSAPLines, GSAPReveal } from './gsap-helpers'

export function CTA() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="rounded-[2rem] bg-primary px-6 py-16 text-center text-primary-foreground sm:px-12 sm:py-24">
          <GSAPLines>
            <h2 className="mx-auto max-w-3xl font-heading text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              <span data-line className="block">Satu sesi hari ini.</span>
              <span data-line className="block">Satu langkah lebih berani.</span>
            </h2>
          </GSAPLines>
          <GSAPReveal delay={0.12}>
            <p className="mx-auto mt-5 max-w-xl leading-relaxed text-primary-foreground/85">
              Gratis untuk siswa, mudah untuk guru. Tanpa kartu kredit.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/auth/sign-up"
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-card px-7 text-base font-semibold text-foreground transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
              >
                Daftar Gratis
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex h-12 items-center justify-center rounded-full border border-primary-foreground/30 px-7 text-base font-semibold text-primary-foreground transition-colors hover:bg-white/10"
              >
                Sudah punya akun?
              </Link>
            </div>
          </GSAPReveal>
        </div>
      </div>
    </section>
  )
}
