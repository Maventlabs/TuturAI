'use client'

import Image from 'next/image'
import { GSAPLines, GSAPReveal } from './gsap-helpers'

type Tile = {
  id: string
  label: string
  caption: string
  src: string
  alt: string
  placement: string
  sizes: string
}

const tiles: Tile[] = [
  {
    id: 'speaking',
    label: 'Speaking AI',
    caption: 'Ngobrol bebas dengan partner AI, dinilai lima dimensi.',
    src: '/hero-student.webp',
    alt: 'Siswa SMA berlatih speaking dengan partner AI TuturAI',
    placement: 'min-h-[320px] lg:col-start-1 lg:row-start-1 lg:row-span-3 lg:min-h-0',
    sizes: '(min-width: 1024px) 45vw, 100vw',
  },
  {
    id: 'dashboard',
    label: 'Dashboard guru',
    caption: 'Tren kelas, kesalahan umum, siswa yang perlu didampingi.',
    src: '/feature-dashboard.png',
    alt: 'Laptop menampilkan dashboard analitik kelas',
    placement: 'min-h-[220px] lg:col-start-2 lg:col-span-2 lg:row-start-1 lg:min-h-0',
    sizes: '(min-width: 1024px) 55vw, 100vw',
  },
  {
    id: 'kuis',
    label: 'Kuis per kata',
    caption: 'Flashcard Easy, Medium, Hard.',
    src: '/feature-flashcards.png',
    alt: 'Tumpukan kartu flashcard di atas meja',
    placement: 'min-h-[200px] lg:col-start-2 lg:row-start-2 lg:min-h-0',
    sizes: '(min-width: 1024px) 28vw, 100vw',
  },
  {
    id: 'listening',
    label: 'Listening',
    caption: 'Audio bertingkat, dari A1 ke C1.',
    src: '/feature-listening.png',
    alt: 'Headphone di atas buku catatan',
    placement: 'min-h-[240px] lg:col-start-3 lg:row-start-2 lg:row-span-2 lg:min-h-0',
    sizes: '(min-width: 1024px) 28vw, 100vw',
  },
  {
    id: 'adaptive',
    label: 'Adaptive learning',
    caption: 'Modul PDF sesuai level.',
    src: '/feature-adaptive.png',
    alt: 'Tablet menampilkan modul belajar di atas meja',
    placement: 'min-h-[200px] lg:col-start-2 lg:row-start-3 lg:min-h-0',
    sizes: '(min-width: 1024px) 28vw, 100vw',
  },
]

export function Features() {
  return (
    <section id="fitur" className="scroll-mt-24 bg-background px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="mx-auto max-w-2xl text-center">
          <GSAPReveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Alat belajar
            </p>
          </GSAPReveal>
          <GSAPLines>
            <h2 className="mt-4 font-heading text-3xl font-bold leading-[1.08] tracking-[-0.02em] text-foreground text-balance sm:text-4xl lg:text-5xl">
              <span data-line className="block">
                Semua alat bicara,
              </span>
              <span data-line className="block">
                dalam satu tempat.
              </span>
            </h2>
          </GSAPLines>
          <GSAPReveal delay={0.1}>
            <p className="mt-5 text-muted-foreground text-pretty">
              Dari partner latihan sampai analitik kelas, dirancang untuk konteks sekolah Indonesia.
            </p>
          </GSAPReveal>
        </div>

        <div className="mt-12 grid gap-3 sm:gap-4 lg:h-[620px] lg:grid-cols-[1.6fr_1fr_1fr] lg:grid-rows-3">
          {tiles.map((tile, index) => (
            <GSAPReveal key={tile.id} delay={index * 0.05} className={tile.placement}>
              <article className="group relative h-full overflow-hidden rounded-sm bg-ink-deep">
                <Image
                  src={tile.src}
                  alt={tile.alt}
                  fill
                  sizes={tile.sizes}
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-linear-to-t from-ink-deep/92 via-ink-deep/50 to-ink-deep/5"
                />
                <div className="relative flex h-full flex-col justify-end p-5 sm:p-6">
                  <h3 className="font-heading text-xl font-bold tracking-[-0.01em] text-white sm:text-2xl">
                    {tile.label}
                  </h3>
                  <p className="mt-1.5 max-w-[34ch] text-sm leading-relaxed text-white/75 text-pretty">
                    {tile.caption}
                  </p>
                </div>
              </article>
            </GSAPReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
