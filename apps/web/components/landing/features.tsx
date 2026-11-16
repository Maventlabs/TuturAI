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
  objectClass?: string
}

/*
 * Every tile owns a fixed aspect ratio so the background photo can be generated
 * at that exact ratio and never gets cropped. Desktop ratios are locked by the
 * grid's own aspect-ratio, so they hold at every width above lg:
 *   speaking 5:8 · dashboard 21:9 · the four small tiles 7:5
 */
const tiles: Tile[] = [
  {
    id: 'speaking',
    label: 'Speaking AI',
    caption:
      'Speaking practice, AI conversation, dan pronunciation lab. Dinilai lima dimensi, bukan satu angka.',
    src: '/feature-speaking.webp',
    alt: 'Siswa SMA berlatih speaking dengan partner AI TuturAI',
    placement: 'aspect-[4/5] lg:aspect-auto lg:col-start-1 lg:row-start-1 lg:row-span-3',
    sizes: '(min-width: 1024px) 42vw, 100vw',
    objectClass: 'object-[center_30%] lg:object-center',
  },
  {
    id: 'dashboard',
    label: 'Dashboard guru',
    caption: 'Analitik kelas, antrean penilaian, dan rekap kesalahan umum dalam satu layar.',
    src: '/feature-dashboard.webp',
    alt: 'Laptop menampilkan dashboard analitik kelas',
    placement: 'aspect-[16/9] lg:aspect-auto lg:col-start-2 lg:col-span-2 lg:row-start-1',
    sizes: '(min-width: 1024px) 55vw, 100vw',
  },
  {
    id: 'kuis',
    label: 'Kuis per kata',
    caption: 'Vocabulary, kuis terpadu, dan tes pedagogis. Tiap kata punya level Easy, Medium, Hard.',
    src: '/feature-flashcards.webp',
    alt: 'Tumpukan kartu flashcard di atas meja',
    placement: 'aspect-[4/3] lg:aspect-auto lg:col-start-2 lg:row-start-2',
    sizes: '(min-width: 1024px) 28vw, 100vw',
  },
  {
    id: 'listening',
    label: 'Listening',
    caption: 'Mode santai atau baku, tiga level, satu menit audio, delapan soal per set.',
    src: '/feature-listening.webp',
    alt: 'Headphone di atas buku catatan',
    placement: 'aspect-[4/3] lg:aspect-auto lg:col-start-3 lg:row-start-2',
    sizes: '(min-width: 1024px) 28vw, 100vw',
  },
  {
    id: 'adaptive',
    label: 'Adaptive learning',
    caption: 'Jalur belajar dan modul PDF yang menyesuaikan level, plus progres dan pencapaian.',
    src: '/feature-adaptive.webp',
    alt: 'Tablet menampilkan modul belajar di atas meja',
    placement: 'aspect-[4/3] lg:aspect-auto lg:col-start-2 lg:row-start-3',
    sizes: '(min-width: 1024px) 28vw, 100vw',
  },
  {
    id: 'hardware',
    label: 'Perangkat offline',
    caption:
      'Latihan tetap jalan tanpa internet. Hasil tersimpan di perangkat, lalu sinkron otomatis begitu tersambung lagi.',
    src: '/feature-device.webp',
    alt: 'Perangkat belajar genggam di atas meja kelas',
    placement: 'aspect-[4/3] lg:aspect-auto lg:col-start-3 lg:row-start-3',
    sizes: '(min-width: 1024px) 28vw, 100vw',
  },
]

export function Features() {
  return (
    <section id="fitur" data-nav-theme="light" className="section-y scroll-mt-24 bg-background px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="mx-auto max-w-2xl text-center">
          <GSAPReveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Isi dalamnya
            </p>
          </GSAPReveal>
          <GSAPLines>
            <h2 className="mt-4 font-display text-3xl font-medium leading-[1.1] tracking-[-0.015em] text-foreground text-balance sm:text-4xl lg:text-5xl">
              <span data-line className="block">
                Semua alat <span className="text-primary">bicara</span>,
              </span>
              <span data-line className="block">
                dalam satu tempat.
              </span>
            </h2>

            <p
              data-line
              className="mt-6 max-w-[58ch] text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg"
            >
              Sembilan alat yang saling terhubung, dari latihan speaking real-time sampai laporan
              PDF untuk guru. Semuanya berbagi satu profil belajar.
            </p>
          </GSAPLines>
        </div>

        <GSAPReveal delay={0.15} className="mt-12 sm:mt-16">
          <div className="rounded-sm bg-primary p-2.5 sm:p-3.5">
            <div className="grid gap-2.5 sm:gap-3 lg:aspect-[1.5] lg:grid-cols-[1.48fr_1fr_1fr] lg:grid-rows-[1.2fr_1fr_1fr]">
              {tiles.map((tile) => (
                <article
                  key={tile.id}
                  className={`group relative overflow-hidden rounded-sm bg-primary-deep ${tile.placement}`}
                >
                  <Image
                    src={tile.src}
                    alt={tile.alt}
                    fill
                    sizes={tile.sizes}
                    className={`object-cover transition-transform duration-500 group-hover:scale-[1.03] ${tile.objectClass ?? 'object-center'}`}
                  />
                  <div
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-[76%] bg-linear-to-t from-primary-ink/96 via-primary-ink/65 to-transparent"
                  />
                  <div className="relative flex h-full flex-col justify-end p-5 sm:p-6">
                    <h3 className="font-heading text-xl font-bold tracking-[-0.01em] text-white sm:text-2xl">
                      {tile.label}
                    </h3>
                    <p className="mt-1.5 max-w-[38ch] text-sm leading-relaxed text-white/90 text-pretty">
                      {tile.caption}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </GSAPReveal>
      </div>
    </section>
  )
}
