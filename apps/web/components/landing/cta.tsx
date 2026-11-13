'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { GSAPLines, GSAPReveal } from './gsap-helpers'

export function CTA() {
  return (
    <section
      data-nav-theme="blue"
      className="relative overflow-hidden bg-primary px-4 pb-32 sm:px-6 sm:pb-40 lg:px-8 lg:pb-48"
    >
      {/* White at the top blends into the FAQ above; primary at the bottom matches the footer. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48 sm:h-72"
        style={{
          backgroundImage:
            'linear-gradient(to bottom, #ffffff 0%, #ffffff 12%, #cfe0ff 38%, #6f9bf8 68%, var(--primary) 90%)',
        }}
      />

      <div className="relative mx-auto max-w-[1400px] pt-48 sm:pt-72">
        <div className="mx-auto max-w-4xl text-center">
          <GSAPReveal>
            <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-primary-foreground">
              Waktunya mulai
              <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" aria-hidden />
            </p>
          </GSAPReveal>

          <GSAPLines>
            <h2 className="mt-6 font-display text-3xl font-medium leading-[1.1] tracking-[-0.015em] text-primary-foreground text-balance sm:text-4xl lg:text-5xl">
              <span data-line className="block">
                Keberanian bicara lahir dari
              </span>
              <span data-line className="block">
                percobaan pertama yang <span className="text-accent-soft">tidak dihakimi</span>.
              </span>
            </h2>
          </GSAPLines>

          <GSAPReveal delay={0.12}>
            <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-primary-foreground text-pretty sm:text-base">
              Gratis untuk siswa, tanpa kartu kredit. Guru bisa langsung mendaftarkan kelasnya.
            </p>

            <div className="mt-12 flex justify-center">
              <Link
                href="/auth/login"
                className="group inline-flex items-center gap-3 rounded-full bg-card py-2 pl-7 pr-2 text-sm font-semibold uppercase tracking-[0.12em] text-foreground transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
              >
                Coba Sekarang
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background">
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            </div>
          </GSAPReveal>
        </div>
      </div>
    </section>
  )
}
